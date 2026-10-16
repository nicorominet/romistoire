import { generationJobRepository as repo } from './generation_job.repository.js';
import { cellStoriesOf, generationJobService, isFramed, seriesStories, storyDayName } from './generation_job.service.js';
import { seriesCastService } from './series_cast.service.js';
import { seriesAuditService } from './series_audit.service.js';
import { aiUsageService } from './ai_usage.service.js';
import { auditModels, geminiConfig, modelsForAge } from './gemini.service.js';
import { castForWeek } from './helpers/cast_validation.helper.js';
import { quotaDayStart } from './helpers/model_limits.helper.js';
import { storyService } from './story.service.js';
import { themeService } from './theme.service.js';
import { weeklyThemeService } from './weeklyTheme.service.js';
import { findSimilarThemes, normalizeThemeName } from '../../shared/themeName.js';
import { ALL_WEEK, VAGUE_TAGS } from './helpers/prompt.helper.js';
import {
  GENERATION_DAYS_FR, DAY_FR_TO_EN, WEEK_STORY_COUNT, buildDayParams, countWords, emptyWeekContext, isIterativeGeneration,
  isShortStory, pacingDelay, paragraphsToHtml, storyEnding, storyOpening
} from './helpers/generation_plan.helper.js';

const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** Tags too vague to describe a story: the prompt forbids them, the worker drops them anyway. */
const VAGUE_TAG_KEYS = new Set(VAGUE_TAGS.map(normalizeThemeName));
/** A story longer than this share of the maximum length of its age is reported in the job log. */
const LONG_STORY_RATIO = 1.6;

/** Text of an HTML content. */
const plainText = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Character sheets as one line for the series ("Antonin : garçon de 3 ans… ; Maman : …"). */
export const characterSheet = (characters) => (characters || [])
  .map(character => `${String(character?.name || '').trim()} : ${String(character?.description || '').trim()}`)
  .filter(line => !line.startsWith(' :'))
  .join(' ; ');

/** Raised between two requests when the job was paused or cancelled: the unit stops where it is. */
class Interrupted extends Error {}

/** Framed job out of quota (models or daily budget): the unit stops where it is, the job waits for the next quota day. */
export class QuotaExhausted extends Interrupted {
  constructor(message) {
    super(message);
    // Read by the audit service: a week audited out of quota is postponed, not failed
    this.postpone = true;
  }
}

/** Every model failed on its daily quota (skipped for it, or answered 429 per day). */
export const isDailyQuotaError = (message) => {
  const reasons = String(message || '').match(/\((.*)\)\.?$/)?.[1]?.split(/,\s*(?=[\w.-]+:)/) || [];
  return reasons.length > 0 && reasons.every(reason => /daily quota/i.test(reason));
};

/** Findings of the audit given to a regeneration that fixes the drifts. */
const MAX_DRIFT_NOTES = 8;
/** How often scheduled jobs are checked (their quota day may have come). */
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
/** Pacific quota day of a date, "YYYY-MM-DD" (daily budget of a framed job). */
const quotaDayKey = (now = new Date()) => quotaDayStart(now).toISOString().slice(0, 10);

/**
 * Runs the mass generation jobs, one at a time, unit by unit, in the server process.
 * A unit is a (week, age) cell. A week written day by day keeps its context (plan, characters,
 * days written) in the unit, so an interrupted or failed week resumes at its first missing day.
 */
export class GenerationWorker {
  /**
   * @param {{sleep?: (ms: number) => Promise<void>, minIntervalMs?: number}} [options] - Injectable for tests.
   */
  constructor({ sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)), minIntervalMs } = {}) {
    this.sleep = sleep;
    this.minIntervalMs = minIntervalMs;
    this.running = null;
    this.lastCloudCall = null;
  }

  /** Starts the loop unless it already runs. Returns the loop promise (tests await it). */
  kick() {
    if (!this.running) {
      this.running = this._loop().finally(() => { this.running = null; });
    }
    return this.running;
  }

  /** At server start: jobs interrupted by a restart go back to the queue. */
  async resumeAfterRestart() {
    const requeued = await repo.requeueInterrupted();
    if (requeued > 0) console.log(`[Generation] ${requeued} interrupted job(s) resumed.`);
    return this.kick();
  }

  /**
   * Framed jobs waiting for the quota: back to the queue when their day has come, checked now and every 5 minutes.
   * @returns {NodeJS.Timeout}
   */
  startScheduler() {
    const check = async () => {
      if (await repo.promoteDueScheduled() > 0) this.kick();
    };
    check().catch(error => console.error('[Generation] Scheduler failed:', error));
    const timer = setInterval(() => check().catch(error => console.error('[Generation] Scheduler failed:', error)), SCHEDULER_INTERVAL_MS);
    timer.unref?.();
    return timer;
  }

  async _loop() {
    let job;
    while ((job = await repo.nextQueuedJob())) {
      try {
        await this.runJob(job);
      } catch (error) {
        // Never leave a job "running" after an unexpected error
        console.error('[Generation] Job failed:', error);
        await repo.updateJob(job.id, { status: 'failed', finishedAt: repo.now(), currentLabel: null });
        await generationJobService.log(job.id, `Job failed: ${error.message}`);
      }
    }
  }

  async runJob(job) {
    await repo.updateJob(job.id, { status: 'running', startedAt: job.startedAt ?? repo.now() });
    await generationJobService.log(job.id, 'Started');
    this.knownThemes = null;

    // Framed: the audits postponed for lack of quota come first
    if (isFramed(job.params)) {
      try {
        await this._auditPostponed(job);
      } catch (error) {
        if (!(error instanceof QuotaExhausted)) throw error;
        await generationJobService.schedule(job.id, `Postponed audits: ${error.message}`);
        return;
      }
    }

    for (const unit of await repo.getUnits(job.id)) {
      if (!['pending', 'running'].includes(unit.status)) continue;
      if (await this._stopped(job.id)) return;
      try {
        await this.runUnit(job, unit);
      } catch (error) {
        if (error instanceof QuotaExhausted) {
          await generationJobService.schedule(job.id, `Week ${unit.weekNumber} · ${unit.ageGroup}: ${error.message}`);
          return;
        }
        if (error instanceof Interrupted) return;
        throw error;
      } finally {
        await generationJobService.refreshCounters(job.id);
      }
    }

    // Paused or cancelled during the last unit: keep that status
    if (await this._stopped(job.id)) return;

    const units = await repo.getUnits(job.id);
    const created = units.reduce((total, u) => total + (u.storyIds?.length || 0), 0);
    const failed = units.filter(u => u.status === 'failed').length;
    await repo.updateJob(job.id, {
      status: created === 0 && failed > 0 ? 'failed' : 'done',
      finishedAt: repo.now(),
      currentLabel: null
    });
    await generationJobService.log(job.id, `Finished: ${created} story(ies) created, ${failed} unit(s) failed`);
  }

  /**
   * Generates one (week, age) cell.
   * - one day: one request;
   * - a whole week of a young age with the cloud provider, nothing written yet: one request;
   * - otherwise day by day, each day continuing the previous ones, skipping the days already written.
   */
  async runUnit(job, unit) {
    const { params } = job;
    const label = `Week ${unit.weekNumber} · ${unit.ageGroup}`;
    await repo.updateUnit(unit.id, { status: 'running', attempts: unit.attempts + 1, error: null });
    await repo.updateJob(job.id, { currentLabel: label });

    const topic = await weeklyThemeService.findByWeek(unit.weekNumber);
    if (!topic) {
      await repo.updateUnit(unit.id, { status: 'skipped', error: 'No topic for this week' });
      return;
    }

    const storyIds = [...(unit.storyIds || [])];
    const cellStories = cellStoriesOf(params, await repo.existingStories(unit.weekNumber, unit.ageGroup));
    // Stories that count as written: every story of the cell, or (option unchecked) only the ones of this unit,
    // so a retry never writes again what a previous attempt saved
    const existing = params.skipExisting ? cellStories : cellStories.filter(story => storyIds.includes(story.id));
    const errors = [];
    const request = {
      theme: topic.theme_name,
      themeDescription: topic.theme_description || undefined,
      weekNumber: unit.weekNumber,
      age: unit.ageGroup,
      numCharacters: params.numCharacters ?? undefined,
      charNames: params.charNames || undefined,
      seriesName: params.seriesName || undefined,
      model: params.model || undefined,
      flashOnly: params.flashOnly || undefined,
      // Titles of the series and of the library, so they are not written again
      avoidTitles: await repo.titlesToAvoid({ seriesName: params.seriesName || null, ageGroup: unit.ageGroup }),
      // Heroes of the series keep their names to themselves; a series keeps its cast from week to week
      reservedNames: await repo.seriesNames(),
      seriesSheet: (await repo.seriesSheet(params.seriesName || null)) || undefined
    };
    if (isFramed(params)) Object.assign(request, await this._framedContext(params, unit));

    if (params.regenerate) {
      await this._regenerateUnit(job, unit, request, seriesStories(cellStories, params.seriesName), storyIds, errors);
    } else if (unit.day !== ALL_WEEK) {
      if (existing.some(story => Number(story.day_order) === GENERATION_DAYS_FR.indexOf(unit.day) + 1)) {
        await repo.updateUnit(unit.id, { status: 'skipped', error: 'Already generated' });
        return;
      }
      await this._generate(job, unit, { ...request, day: unit.day }, unit.day, storyIds, errors);
    } else {
      const writtenOrders = new Set(existing.map(story => Number(story.day_order)));
      const iterative = isIterativeGeneration(ALL_WEEK, unit.ageGroup, params.provider);
      const startedDayByDay = Boolean(unit.context);

      if (writtenOrders.size >= WEEK_STORY_COUNT && !startedDayByDay) {
        await repo.updateUnit(unit.id, { status: 'skipped', error: 'Already generated' });
        return;
      }

      if (!iterative && writtenOrders.size === 0 && !startedDayByDay) {
        const created = await this._keepOnQuota(unit, storyIds, null,
          () => this._generate(job, unit, { ...request, day: ALL_WEEK }, null, storyIds, errors));
        if (created > 0 && created < WEEK_STORY_COUNT) {
          errors.push(`Only ${created} of ${WEEK_STORY_COUNT} stories in the answer`);
        }
      } else {
        await this._generateDayByDay(job, unit, request, existing, storyIds, errors);
      }
    }

    // Any missing story makes the unit "failed": a retry only writes what is missing
    await repo.updateUnit(unit.id, { status: errors.length === 0 ? 'done' : 'failed', storyIds, error: errors.length ? errors.join(' | ') : null });
    // Framed: a complete week is audited against the bible (its recap and facts feed the next weeks)
    if (isFramed(params) && errors.length === 0) await this._auditUnit(job, unit);
  }

  /**
   * Audit of a framed week: local checks, and one AI request when the job asks for it. Out of quota, the audit is
   * postponed (the job waits, then audits it first); any other failure is only logged.
   * @throws {QuotaExhausted}
   */
  async _auditUnit(job, unit) {
    const { params } = job;
    const where = `Week ${unit.weekNumber} · ${unit.ageGroup}`;
    try {
      const audit = await seriesAuditService.auditStoredWeek({
        castId: params.castId, ageGroup: unit.ageGroup, weekNumber: unit.weekNumber, useAI: params.audit,
        provider: params.provider, rewritten: params.regenerate, beforeRequest: () => this._beforeRequest(job, unit, { audit: true })
      });
      const high = audit.issues.filter(issue => issue.severity === 'high').length;
      const details = [
        high ? `${high} high` : '',
        audit.newFacts.length ? `${audit.newFacts.length} fact(s) proposed` : '',
        audit.stale ? `${audit.stale} later week(s) to check again` : ''
      ].filter(Boolean).join(', ');
      await generationJobService.log(job.id, `${where}: audit ${audit.status}, ${audit.issues.length} issue(s)${details ? ` (${details})` : ''}`);
    } catch (error) {
      if (error instanceof QuotaExhausted) {
        await generationJobService.log(job.id, `${where}: audit postponed (${error.message})`);
        throw error;
      }
      await generationJobService.log(job.id, `${where}: audit failed: ${error.message}`);
    }
  }

  /** Weeks of the job written but whose audit waited for the quota. */
  async _auditPostponed(job) {
    for (const unit of (await repo.getUnits(job.id)).filter(u => u.status === 'done')) {
      const recap = await seriesCastService.getRecap(job.params.castId, unit.ageGroup, unit.weekNumber);
      if (recap?.audit?.status === 'postponed') await this._auditUnit(job, unit);
    }
  }

  /**
   * Rewrites the stories of a (week, age, series) cell in place: same ids, illustrations kept, old text in the
   * versions, back to "to review". The days not asked again are the context of the others.
   * A whole week of a young age is one request; otherwise day by day.
   */
  async _regenerateUnit(job, unit, request, cell, storyIds, errors) {
    const { params } = job;
    const days = params.regenerateDays?.length ? params.regenerateDays : GENERATION_DAYS_FR;
    const replace = new Map(cell.filter(story => days.includes(storyDayName(story))).map(story => [storyDayName(story), story.id]));
    // Already rewritten by a previous attempt of this unit: context, not rewritten twice
    const kept = cell.filter(story => !days.includes(storyDayName(story)) || storyIds.includes(story.id));
    const wholeWeek = days.length === WEEK_STORY_COUNT && !isIterativeGeneration(ALL_WEEK, unit.ageGroup, params.provider);

    if (wholeWeek && kept.length === 0 && !unit.context) {
      await this._keepOnQuota(unit, storyIds, null,
        () => this._generate(job, unit, { ...request, day: ALL_WEEK }, null, storyIds, errors, replace));
    } else {
      await this._generateDayByDay(job, unit, request, kept, storyIds, errors, replace);
    }
  }

  /** Days of a week, in order; days already written (before the job or by a previous attempt) are kept as context. */
  async _generateDayByDay(job, unit, request, existing, storyIds, errors, replace = null) {
    const context = unit.context || emptyWeekContext();
    const doneDays = new Set(context.days.map(day => day.day));
    // Texts already written this week: a new day must not copy one of them (quality gate)
    const previousTexts = existing.map(story => plainText(story.content));

    // Days written before this job start the context, so the new days follow them
    for (const story of existing) {
      const day = GENERATION_DAYS_FR[Number(story.day_order) - 1];
      if (!day || doneDays.has(day)) continue;
      const opening = storyOpening(story.content);
      context.days.push({ day, title: story.title, summary: story.summary || opening, ending: storyEnding(story.content), opening });
      doneDays.add(day);
    }
    context.days.sort((a, b) => GENERATION_DAYS_FR.indexOf(a.day) - GENERATION_DAYS_FR.indexOf(b.day));

    for (const day of GENERATION_DAYS_FR) {
      if (doneDays.has(day)) continue;
      if (await this._stopped(job.id)) {
        // Back to pending with its context: resumed at this day
        await repo.updateUnit(unit.id, { status: 'pending', context, storyIds });
        throw new Interrupted();
      }
      await repo.updateJob(job.id, { currentLabel: `Week ${unit.weekNumber} · ${unit.ageGroup} · ${day}` });

      const dayIndex = GENERATION_DAYS_FR.indexOf(day);
      const priorContext = { ...context, days: context.days.filter(({ day: contextDay }) => GENERATION_DAYS_FR.indexOf(contextDay) < dayIndex) };
      const outcome = await this._keepOnQuota(unit, storyIds, context,
        () => this._generate(job, unit, { ...request, day, ...buildDayParams(priorContext), previousTexts: [...previousTexts] }, day, storyIds, errors, replace));
      if (outcome.weekPlan && !context.weekPlan) context.weekPlan = outcome.weekPlan;
      if (outcome.characters && !context.characters) context.characters = outcome.characters;
      if (outcome.lastDay) {
        const { text, ...lastDay } = outcome.lastDay;
        previousTexts.push(text);
        context.days.push(lastDay);
        doneDays.add(day);
      } else {
        // A day that failed: the next days can still be written, the retry will fill the gap
        errors.push(`${day}: not written`);
      }
      await repo.updateUnit(unit.id, { context, storyIds });
    }
  }

  /**
   * One AI request and the stories it returns, saved.
   * @param {string|null} day - The day asked (null: a whole week in one request).
   * @param {Map<string, string>|null} [replace] - Regeneration: day -> id of the story rewritten in place.
   * @returns {Promise<number|{weekPlan, characters, lastDay}>} Stories created (whole week) or the day written.
   */
  async _generate(job, unit, request, day, storyIds, errors, replace = null) {
    const { provider } = job.params;

    let result;
    try {
      result = await storyService.generateFromAI(request, provider, { beforeRequest: () => this._beforeRequest(job, unit) });
    } catch (error) {
      // Framed: out of quota is not a failure, the job waits for the next quota day
      if (error instanceof QuotaExhausted) throw error;
      if (isFramed(job.params) && isDailyQuotaError(error.message)) throw new QuotaExhausted('daily quota reached');
      errors.push(error.message);
      await generationJobService.log(job.id, `Week ${unit.weekNumber} · ${unit.ageGroup}${day ? ` · ${day}` : ''}: ${error.message}`);
      return day ? {} : 0;
    }
    if (result.model) await repo.updateUnit(unit.id, { model: result.model });
    // The first character sheet of a series becomes its fixed sheet for the next weeks
    if (request.seriesName && !request.seriesSheet && !request.cast && result.characters?.length) {
      await repo.saveSeriesSheet(request.seriesName, characterSheet(result.characters));
    }

    const stories = result.stories || [];
    if (stories.length === 0) {
      errors.push('The AI answer could not be read');
      return day ? {} : 0;
    }

    let created = 0;
    let lastDay = null;
    const notes = [];
    // One day asked: the first story is that day
    for (const story of day ? stories.slice(0, 1) : stories) {
      const storyDay = day || story.day;
      if (!storyDay) continue;
      try {
        const content = paragraphsToHtml(story.paragraphs);
        const text = {
          title: story.title || 'Sans titre',
          content,
          themes: await this._resolveThemes(story.themes, request),
          illustrationPrompt: story.illustration_prompt || story.illustrationPrompt || null,
          summary: story.summary || null
        };
        const replacedId = replace?.get(storyDay);
        const saved = replacedId
          ? { ...(await storyService.update(replacedId, text, { regenerated: true })), id: replacedId }
          : await storyService.create({
            ...text,
            ageGroup: unit.ageGroup,
            locale: 'fr',
            dayOfWeek: DAY_FR_TO_EN[storyDay] || 'Monday',
            weekNumber: unit.weekNumber,
            seriesName: request.seriesName,
            source: provider === 'local' ? 'ollama' : 'gemini',
            generationJobId: job.id
          });
        if (replacedId) notes.push(`${storyDay} rewritten in place`);
        storyIds.push(saved.id);
        created++;
        const words = countWords(content);
        if (isShortStory(words, result.targetWords)) {
          notes.push(`${storyDay} short: ${words} words / ${result.targetWords.min} minimum`);
        } else if (result.targetWords?.max && words > result.targetWords.max * LONG_STORY_RATIO) {
          notes.push(`${storyDay} long: ${words} words / ${result.targetWords.max} maximum`);
        }
        if (saved.aliasSeries) notes.push(`${storyDay} placed in the series "${saved.aliasSeries.name}" (slot taken)`);
        // Defects still there after the second try: the story stays "to review", the log says why
        const storyIndex = stories.indexOf(story);
        const left = (result.defects || []).filter(defect => defect.index === storyIndex);
        if (left.length) notes.push(`${storyDay} to check: ${left.map(defect => `${defect.code} (${defect.detail})`).join(', ')}`);
        lastDay = { day: storyDay, title: story.title, summary: story.summary || '', ending: storyEnding(content), opening: storyOpening(content), text: plainText(content) };
      } catch (error) {
        errors.push(`${storyDay}: ${error.message}`);
      }
    }
    const where = `Week ${unit.weekNumber} · ${unit.ageGroup}${day ? ` · ${day}` : ''}`;
    await generationJobService.log(job.id, `${where}: ${created} story(ies) saved${notes.length ? ` (${notes.join('; ')})` : ''}`);
    return day ? { weekPlan: result.weekPlan, characters: result.characters, lastDay } : created;
  }

  /**
   * Story themes chosen by the AI: an existing similar theme is reused, otherwise created ("to review").
   * The topic of the week is used only when the AI gave no theme (a story needs one).
   */
  async _resolveThemes(aiThemes, request) {
    if (!this.knownThemes) this.knownThemes = await themeService.findAll();
    const themes = [];
    const add = (theme) => {
      if (theme && !themes.some(t => t.id === theme.id)) themes.push({ id: theme.id, isPrimary: themes.length === 0 });
    };
    const resolve = async ({ name, description, icon, color }) => {
      const clean = String(name || '').trim();
      if (!clean) return null;
      const similar = findSimilarThemes(clean, this.knownThemes)[0];
      if (similar) return similar;
      const data = { name: clean, description: description || '', source: 'ai' };
      if (COLOR_RE.test(color || '')) data.color = color;
      if (icon) data.icon = icon;
      let theme;
      try {
        ({ theme } = await themeService.create(data));
      } catch (error) {
        // An invalid icon or color must not cost the theme
        ({ theme } = await themeService.create({ name: clean, description: data.description, source: 'ai' }));
      }
      this.knownThemes.push(theme);
      return theme;
    };

    for (const aiTheme of Array.isArray(aiThemes) ? aiThemes : []) {
      if (VAGUE_TAG_KEYS.has(normalizeThemeName(aiTheme?.name))) continue;
      try { add(await resolve(aiTheme)); } catch (error) { /* skip an unusable theme */ }
    }
    if (themes.length === 0) add(await resolve({ name: request.theme, description: request.themeDescription }));
    return themes;
  }

  /**
   * Bible of a framed job for a week: the cast as told that week (ages, birthdays), the facts approved before it and
   * the recaps of the last weeks. The old automatic sheet of the series is not used.
   */
  async _framedContext(params, unit) {
    const cast = await seriesCastService.get(params.castId);
    const recap = params.fixDrift ? await seriesCastService.getRecap(cast.id, unit.ageGroup, unit.weekNumber) : null;
    return {
      cast: castForWeek(cast, unit.weekNumber),
      castDriftNotes: (recap?.audit?.issues || [])
        .filter(issue => issue.severity !== 'low')
        .map(issue => `${issue.day ? `${issue.day} : ` : ''}${issue.explanation}`)
        .slice(0, MAX_DRIFT_NOTES),
      castFacts: await seriesCastService.factsBefore(cast.id, unit.ageGroup, unit.weekNumber),
      castRecaps: await seriesCastService.recapsBefore(cast.id, unit.ageGroup, unit.weekNumber),
      seriesSheet: undefined
    };
  }

  /** Runs a generation; out of quota, the unit goes back to pending with what it wrote (resumed at its missing day). */
  async _keepOnQuota(unit, storyIds, context, run) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof QuotaExhausted) {
        await repo.updateUnit(unit.id, { status: 'pending', storyIds, ...(context ? { context } : {}) });
      }
      throw error;
    }
  }

  /**
   * Before every AI request: the pacing; for a framed job on Gemini, the quota left today for the models of the age
   * group and the daily budget of the job (counted here).
   * @throws {QuotaExhausted}
   */
  async _beforeRequest(job, unit, { audit = false } = {}) {
    const { params } = job;
    if (isFramed(params) && params.provider === 'gemini') {
      // The models of this request: the audit has its own (Flash Lite), the stories those of their age group.
      // Gemma, slow last resort with a huge quota, is never counted
      const models = (audit
        ? auditModels()
        : params.model ? [params.model] : modelsForAge(geminiConfig().models, unit.ageGroup, { flashOnly: params.flashOnly }))
        .filter(model => !model.startsWith('gemma-'));
      const remaining = await aiUsageService.remainingToday(models);
      if (remaining !== null && remaining < 1) throw new QuotaExhausted('no quota left today');
      await this._spendBudget(job);
    }
    await this._pace(params.provider);
  }

  /** One request of the daily budget of a framed job (none: no limit). */
  async _spendBudget(job) {
    const today = quotaDayKey();
    const current = await repo.getJob(job.id);
    const used = current?.budgetDay === today ? current.budgetUsed : 0;
    if (job.params.dailyBudget && used >= job.params.dailyBudget) throw new QuotaExhausted(`daily budget of ${job.params.dailyBudget} requests reached`);
    await repo.updateJob(job.id, { budgetDay: today, budgetUsed: used + 1 });
  }

  /** Cloud requests start at least the minimal interval apart (free tier rate limit). */
  async _pace(provider) {
    if (provider === 'local') return;
    const delay = pacingDelay(this.lastCloudCall, Date.now(), this.minIntervalMs);
    if (delay > 0) await this.sleep(delay);
    this.lastCloudCall = Date.now();
  }

  async _stopped(jobId) {
    const job = await repo.getJob(jobId);
    return !job || job.status !== 'running';
  }
}

export const generationWorker = new GenerationWorker();
generationJobService.onQueued = () => { generationWorker.kick(); };
