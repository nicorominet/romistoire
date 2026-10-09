import { generationJobRepository as repo } from './generation_job.repository.js';
import { generationJobService } from './generation_job.service.js';
import { storyService } from './story.service.js';
import { themeService } from './theme.service.js';
import { weeklyThemeService } from './weeklyTheme.service.js';
import { findSimilarThemes } from './helpers/theme_name.helper.js';
import { ALL_WEEK, VAGUE_TAGS } from './helpers/prompt.helper.js';
import { normalizeThemeName } from './helpers/theme_name.helper.js';
import {
  GENERATION_DAYS_FR, DAY_FR_TO_EN, WEEK_STORY_COUNT, buildDayParams, countWords, emptyWeekContext, isIterativeGeneration,
  isShortStory, pacingDelay, paragraphsToHtml, storyEnding, storyOpening
} from './helpers/generation_plan.helper.js';

const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** Tags too vague to describe a story: the prompt forbids them, the worker drops them anyway. */
const VAGUE_TAG_KEYS = new Set(VAGUE_TAGS.map(normalizeThemeName));
/** A story longer than this share of the maximum length of its age is reported in the job log. */
const LONG_STORY_RATIO = 1.6;

/** Raised between two requests when the job was paused or cancelled: the unit stops where it is. */
class Interrupted extends Error {}

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

    for (const unit of await repo.getUnits(job.id)) {
      if (!['pending', 'running'].includes(unit.status)) continue;
      if (await this._stopped(job.id)) return;
      try {
        await this.runUnit(job, unit);
      } catch (error) {
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
    // Stories that count as written: every story of the cell, or (option unchecked) only the ones of this unit,
    // so a retry never writes again what a previous attempt saved
    const cellStories = await repo.existingStories(unit.weekNumber, unit.ageGroup);
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
      // Titles of the other weeks of the series, so they are not written again
      avoidTitles: await repo.recentTitles({ seriesName: params.seriesName || null, ageGroup: unit.ageGroup })
    };

    if (unit.day !== ALL_WEEK) {
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
        const created = await this._generate(job, unit, { ...request, day: ALL_WEEK }, null, storyIds, errors);
        if (created > 0 && created < WEEK_STORY_COUNT) {
          errors.push(`Only ${created} of ${WEEK_STORY_COUNT} stories in the answer`);
        }
      } else {
        await this._generateDayByDay(job, unit, request, existing, storyIds, errors);
      }
    }

    // Any missing story makes the unit "failed": a retry only writes what is missing
    await repo.updateUnit(unit.id, { status: errors.length === 0 ? 'done' : 'failed', storyIds, error: errors.length ? errors.join(' | ') : null });
  }

  /** Days of a week, in order; days already written (before the job or by a previous attempt) are kept as context. */
  async _generateDayByDay(job, unit, request, existing, storyIds, errors) {
    const context = unit.context || emptyWeekContext();
    const doneDays = new Set(context.days.map(day => day.day));

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
      const outcome = await this._generate(job, unit, { ...request, day, ...buildDayParams(priorContext) }, day, storyIds, errors);
      if (outcome.weekPlan && !context.weekPlan) context.weekPlan = outcome.weekPlan;
      if (outcome.characters && !context.characters) context.characters = outcome.characters;
      if (outcome.lastDay) {
        context.days.push(outcome.lastDay);
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
   * @returns {Promise<number|{weekPlan, characters, lastDay}>} Stories created (whole week) or the day written.
   */
  async _generate(job, unit, request, day, storyIds, errors) {
    const { provider } = job.params;

    let result;
    try {
      result = await storyService.generateFromAI(request, provider, { beforeRequest: () => this._pace(provider) });
    } catch (error) {
      errors.push(error.message);
      await generationJobService.log(job.id, `Week ${unit.weekNumber} · ${unit.ageGroup}${day ? ` · ${day}` : ''}: ${error.message}`);
      return day ? {} : 0;
    }
    if (result.model) await repo.updateUnit(unit.id, { model: result.model });

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
        const saved = await storyService.create({
          title: story.title || 'Sans titre',
          content,
          themes: await this._resolveThemes(story.themes, request),
          ageGroup: unit.ageGroup,
          locale: 'fr',
          dayOfWeek: DAY_FR_TO_EN[storyDay] || 'Monday',
          weekNumber: unit.weekNumber,
          seriesName: request.seriesName,
          source: provider === 'local' ? 'ollama' : 'gemini',
          illustrationPrompt: story.illustration_prompt || story.illustrationPrompt || null,
          summary: story.summary || null,
          generationJobId: job.id
        });
        storyIds.push(saved.id);
        created++;
        const words = countWords(content);
        if (isShortStory(words, result.targetWords)) {
          notes.push(`${storyDay} short: ${words} words / ${result.targetWords.min} minimum`);
        } else if (result.targetWords?.max && words > result.targetWords.max * LONG_STORY_RATIO) {
          notes.push(`${storyDay} long: ${words} words / ${result.targetWords.max} maximum`);
        }
        if (saved.aliasSeries) notes.push(`${storyDay} placed in the series "${saved.aliasSeries.name}" (slot taken)`);
        lastDay = { day: storyDay, title: story.title, summary: story.summary || '', ending: storyEnding(content), opening: storyOpening(content) };
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
