import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/error.middleware.js';
import { generationJobRepository as repo } from './generation_job.repository.js';
import { weeklyThemeService } from './weeklyTheme.service.js';
import { storyService } from './story.service.js';
import { defaultProvider, PROVIDERS } from './settings.service.js';
import { ALL_WEEK } from './helpers/prompt.helper.js';
import { GENERATION_DAYS_FR, GENERATION_MIN_INTERVAL_MS, WEEK_STORY_COUNT, requestsPerUnit } from './helpers/generation_plan.helper.js';
import { FLASH_FIRST_AGES, geminiConfig, isFlashModel } from './gemini.service.js';
import { aiUsageService } from './ai_usage.service.js';
import { seriesCastService } from './series_cast.service.js';
import { modelLimits } from './helpers/model_limits.helper.js';
import { msUntilPacificMidnight } from './helpers/model_cooldown.helper.js';

export const AGE_GROUPS = ['2-3', '4-6', '7-9', '10-12', '13-15', '16-18'];
const MAX_WEEK = 53;
/** A job is limited to 53 weeks x 6 ages. */
const MAX_UNITS = MAX_WEEK * AGE_GROUPS.length;

/** Rough length of one request, for the estimate shown before launching (seconds). */
const ESTIMATED_SECONDS = { gemini: 25, local: 90 };

const ACTIVE = ['queued', 'running', 'scheduled'];
/** Framed generation (tab "Génération cadrée"): a series bible, its audit and the quota planning. */
export const FRAMED = 'framed';
export const isFramed = (params) => params?.mode === FRAMED;
const MAX_DAILY_BUDGET = 10000;
const FINISHED = ['done', 'failed', 'cancelled'];

/**
 * Checks and normalizes the parameters of a job.
 * @returns {{weeks: number[], ages: string[], day: string, numCharacters: number|null, charNames: string,
 *   seriesName: string, provider: 'gemini'|'local', model: string|null, skipExisting: boolean}}
 * @throws {ValidationError}
 */
export const normalizeJobParams = (input = {}) => {
  const weeks = [...new Set((Array.isArray(input.weeks) ? input.weeks : []).map(Number))]
    .filter(week => Number.isInteger(week) && week >= 1 && week <= MAX_WEEK)
    .sort((a, b) => a - b);
  if (weeks.length === 0) throw new ValidationError('Choose at least one week');

  const ages = AGE_GROUPS.filter(age => (Array.isArray(input.ages) ? input.ages : []).includes(age));
  if (ages.length === 0) throw new ValidationError('Choose at least one age group');

  const day = input.day || ALL_WEEK;
  if (day !== ALL_WEEK && !GENERATION_DAYS_FR.includes(day)) throw new ValidationError('Invalid day');

  const provider = input.provider || defaultProvider();
  if (!PROVIDERS.includes(provider)) throw new ValidationError('Invalid provider');

  const numCharacters = input.numCharacters === undefined || input.numCharacters === null || input.numCharacters === ''
    ? null : Number(input.numCharacters);
  if (numCharacters !== null && (!Number.isInteger(numCharacters) || numCharacters < 1 || numCharacters > 10)) {
    throw new ValidationError('Number of characters must be between 1 and 10');
  }

  // Regenerate: the stories already written are rewritten in place (same ids, illustrations kept, old text in
  // the versions); regenerateDays limits it to some days, the other days being the context
  const regenerate = input.regenerate === true;
  if (regenerate && day !== ALL_WEEK) throw new ValidationError('Regeneration works on whole weeks');
  const regenerateDays = regenerate && Array.isArray(input.regenerateDays)
    ? GENERATION_DAYS_FR.filter(d => input.regenerateDays.includes(d))
    : [];

  const params = {
    weeks,
    ages,
    day,
    numCharacters,
    charNames: String(input.charNames ?? '').trim().slice(0, 500),
    seriesName: String(input.seriesName ?? '').trim().slice(0, 255),
    provider,
    model: input.model ? String(input.model).trim().slice(0, 100) : null,
    skipExisting: input.skipExisting !== false,
    regenerate,
    regenerateDays,
    // Only the recommended Flash models: a saturated day fails (retry later) instead of falling back to Flash Lite
    flashOnly: input.flashOnly === true
  };
  if (input.mode !== FRAMED) return params;

  // Framed: the cast of the series is the only source of characters
  if (!input.castId) throw new ValidationError('Choose a cast');
  const dailyBudget = input.dailyBudget === undefined || input.dailyBudget === null || input.dailyBudget === ''
    ? null : Number(input.dailyBudget);
  if (dailyBudget !== null && (!Number.isInteger(dailyBudget) || dailyBudget < 1 || dailyBudget > MAX_DAILY_BUDGET)) {
    throw new ValidationError('The daily budget must be a positive number of requests');
  }
  return {
    ...params,
    mode: FRAMED,
    castId: String(input.castId),
    numCharacters: null,
    charNames: '',
    audit: input.audit !== false,
    dailyBudget,
    // Regeneration of the days the audit found drifting: its findings are given to the AI
    fixDrift: params.regenerate && input.fixDrift === true
  };
};

/**
 * A framed job takes its series from its cast, and only the age groups of that cast.
 * @throws {ValidationError}
 */
export const frameJobParams = async (params) => {
  if (!isFramed(params)) return params;
  const cast = await seriesCastService.get(params.castId);
  const outside = params.ages.filter(age => !cast.ageGroups.includes(age));
  if (outside.length) throw new ValidationError(`No cast for the age group(s) ${outside.join(', ')}`);
  const seriesName = await seriesCastService.seriesName(cast.seriesId);
  return { ...params, seriesId: cast.seriesId, seriesName };
};

/** Next reset of the Gemini daily quotas (Pacific midnight), with a margin. */
export const nextQuotaReset = (now = new Date()) =>
  new Date(now.getTime() + msUntilPacificMidnight(now) + 5 * 60 * 1000);

/** Day name of a story ("Lundi"). */
export const storyDayName = (story) => GENERATION_DAYS_FR[Number(story.day_order) - 1];

/** Stories of a cell that belong to the series of the job (no series: the stories without series). */
export const seriesStories = (stories, seriesName) => stories.filter(story => (story.series_name || '') === (seriesName || ''));

/**
 * Stories of a cell a job counts as written: every story of the cell (free generation),
 * only those of its series for a framed job (a free story of the same week does not fill the series).
 */
export const cellStoriesOf = (params, stories) => (isFramed(params) ? seriesStories(stories, params.seriesName) : stories);

/** Days of a request already written in a cell (day_order 1-7). */
const writtenDays = (stories) => new Set(stories.map(story => Number(story.day_order)));

/**
 * Plan of a job: one unit per (week, age), with what is already done. Read-only.
 * @returns {Promise<{units: Object[], requests: number, skipped: number, missingTopics: number[]}>}
 */
export const planJob = async (params) => {
  const topics = new Map((await weeklyThemeService.findAll()).map(week => [Number(week.week_number), week]));
  const units = [];
  let requests = 0;
  // Requests written by the Flash models (from 7 years old, or every age with flashOnly): their daily quota is small
  let flashRequests = 0;
  let position = 0;
  const missingTopics = new Set();

  for (const weekNumber of params.weeks) {
    for (const ageGroup of params.ages) {
      const before = requests;
      const countFlash = () => {
        if (params.flashOnly || FLASH_FIRST_AGES.includes(ageGroup)) flashRequests += requests - before;
      };
      const unit = { id: uuidv4(), position: position++, weekNumber, ageGroup, day: params.day, status: 'pending', error: null };
      units.push(unit);
      if (!topics.has(weekNumber)) {
        unit.status = 'skipped';
        unit.error = 'No topic for this week';
        missingTopics.add(weekNumber);
        continue;
      }
      if (params.regenerate) {
        const days = params.regenerateDays.length ? params.regenerateDays : GENERATION_DAYS_FR;
        const toRewrite = seriesStories(await repo.existingStories(weekNumber, ageGroup), params.seriesName)
          .filter(story => days.includes(storyDayName(story)));
        if (toRewrite.length === 0) {
          unit.status = 'skipped';
          unit.error = 'Nothing to regenerate';
          continue;
        }
        requests += days.length === WEEK_STORY_COUNT ? requestsPerUnit(ALL_WEEK, ageGroup, params.provider) : days.length;
        countFlash();
        if (isFramed(params) && params.audit) requests += 1;
        continue;
      }
      const done = params.skipExisting ? writtenDays(cellStoriesOf(params, await repo.existingStories(weekNumber, ageGroup))) : new Set();
      if (params.day === ALL_WEEK) {
        const missing = WEEK_STORY_COUNT - [...done].filter(order => order >= 1 && order <= 7).length;
        if (missing === 0) {
          unit.status = 'skipped';
          unit.error = 'Already generated';
          continue;
        }
        // A partly written week is completed day by day; a full week follows the usual plan
        requests += missing < WEEK_STORY_COUNT ? missing : requestsPerUnit(params.day, ageGroup, params.provider);
      } else {
        if (done.has(GENERATION_DAYS_FR.indexOf(params.day) + 1)) {
          unit.status = 'skipped';
          unit.error = 'Already generated';
          continue;
        }
        requests += 1;
      }
      countFlash();
      // Framed: the audit of the week, written by Flash Lite
      if (isFramed(params) && params.audit) requests += 1;
    }
  }
  return { units, requests, flashRequests, skipped: units.filter(u => u.status === 'skipped').length, missingTopics: [...missingTopics] };
};

/** Seconds for `requests` calls: the model time, at least the pacing interval for the cloud. */
const estimateSeconds = (requests, provider) =>
  requests * Math.max(ESTIMATED_SECONDS[provider] ?? 30, provider === 'local' ? 0 : GENERATION_MIN_INTERVAL_MS / 1000);

/**
 * Quota planning of a framed job: requests it may send a day (free tier limits of its models, daily budget),
 * today and the next days, and the number of quota days it takes.
 * @returns {{perDay: number|null, today: number|null, days: number|null}} null: unknown limits.
 */
export const scheduleOf = (requests, flashRequests, { flashModels, liteModels, remainingFlash, remainingLite, dailyBudget = null, flashOnly = false }) => {
  const sum = (models) => models.reduce((total, model) => total + (modelLimits(model).rpd ?? 0), 0);
  // Flash requests fall back to Flash Lite unless flashOnly: the families are counted together, Flash first
  const capacity = flashOnly ? sum(flashModels) : sum(flashModels) + sum(liteModels);
  const left = remainingFlash === null || remainingLite === null ? null
    : (flashOnly ? remainingFlash : remainingFlash + remainingLite);
  const cap = (value) => (value === null ? null : dailyBudget ? Math.min(value, dailyBudget) : value);
  const perDay = cap(capacity || null);
  const today = cap(left);
  const needed = flashOnly ? flashRequests : requests;
  if (perDay === null || today === null || perDay <= 0) return { perDay, today, days: null };
  const days = needed <= today ? 1 : 1 + Math.ceil((needed - today) / perDay);
  return { perDay, today, days };
};

class GenerationJobService {
  constructor() {
    /** Set by the worker module (avoids an import cycle): wakes the worker up. */
    this.onQueued = () => {};
  }

  /** What a job would do, without creating it. */
  async estimate(input) {
    const params = await frameJobParams(normalizeJobParams(input));
    const { units, requests, flashRequests, skipped, missingTopics } = await planJob(params);
    const base = {
      units: units.length,
      toGenerate: units.length - skipped,
      skipped,
      missingTopics,
      requests,
      estimatedSeconds: estimateSeconds(requests, params.provider)
    };
    if (params.provider !== 'gemini') return { ...base, remainingRequests: null, quota: null, quotaWarning: false };

    // Free tier, per family: the Flash models have about 20 requests a day each (5 a minute for some), Flash Lite
    // much more. A total over every model hid that the Flash ones were spent (Gemma, slow last resort, left out).
    if (params.model) {
      const remaining = await aiUsageService.remainingToday([params.model]);
      return { ...base, remainingRequests: remaining, quota: null, quotaWarning: remaining !== null && requests > remaining };
    }
    const models = geminiConfig().models;
    const flashModels = models.filter(model => isFlashModel(model) && !(params.flashOnly && model === 'gemini-2.5-flash'));
    const liteModels = models.filter(model => model.includes('flash-lite'));
    const remainingFlash = await aiUsageService.remainingToday(flashModels);
    const remainingLite = await aiUsageService.remainingToday(liteModels);
    const liteRequests = requests - flashRequests;
    // Framed: what the job can send a day, and how many quota days it takes (it waits for the next day by itself)
    const schedule = isFramed(params) ? scheduleOf(requests, flashRequests, {
      flashModels, liteModels, remainingFlash, remainingLite, dailyBudget: params.dailyBudget, flashOnly: params.flashOnly
    }) : undefined;
    // Not enough Flash: the rest falls back to Flash Lite (or fails with flashOnly, to be retried later)
    const flashShortfall = remainingFlash !== null && flashRequests > remainingFlash;
    const liteShortfall = remainingLite !== null
      && liteRequests + (flashShortfall && !params.flashOnly ? flashRequests - remainingFlash : 0) > remainingLite;
    return {
      ...base,
      remainingRequests: remainingFlash === null || remainingLite === null ? null : remainingFlash + remainingLite,
      quota: {
        flash: { requests: flashRequests, remaining: remainingFlash },
        lite: { requests: liteRequests, remaining: remainingLite },
        flashShortfall
      },
      quotaWarning: flashShortfall || liteShortfall,
      ...(schedule ? { schedule } : {})
    };
  }

  async create(input) {
    const params = await frameJobParams(normalizeJobParams(input));
    const { units } = await planJob(params);
    if (units.length > MAX_UNITS) throw new ValidationError('Too many units');
    if (units.every(unit => unit.status === 'skipped')) {
      throw new ValidationError(params.regenerate
        ? 'Nothing to regenerate: the selected weeks have no story'
        : 'Nothing to generate: every selected week is already written or has no topic');
    }
    const id = uuidv4();
    await repo.insertJob({ id, params, provider: params.provider, model: params.model, units });
    await this.refreshCounters(id);
    this.onQueued();
    return this.get(id);
  }

  async list() {
    // The log stays in the detail view
    return (await repo.listJobs()).map(({ log, ...job }) => job);
  }

  async get(id) {
    const job = await repo.getJob(id);
    if (!job) throw new NotFoundError('Generation job not found');
    return { ...job, units: await repo.getUnits(id) };
  }

  async pause(id) {
    const job = await this._require(id);
    if (!ACTIVE.includes(job.status)) throw new ConflictError('Only a queued or running job can be paused');
    await repo.updateJob(id, { status: 'paused' });
    await this.log(id, 'Paused');
    return this.get(id);
  }

  /** A paused job, or a job waiting for the quota (resumed now, at the risk of failing on the quota). */
  async resume(id) {
    const job = await this._require(id);
    if (!['paused', 'scheduled'].includes(job.status)) throw new ConflictError('Only a paused or scheduled job can be resumed');
    await repo.updateJob(id, { status: 'queued', finishedAt: null, resumeAt: null });
    await this.log(id, 'Resumed');
    this.onQueued();
    return this.get(id);
  }

  async cancel(id) {
    const job = await this._require(id);
    if (FINISHED.includes(job.status)) throw new ConflictError('This job is already finished');
    await repo.updateJob(id, { status: 'cancelled', finishedAt: repo.now(), currentLabel: null });
    await this.log(id, 'Cancelled');
    return this.get(id);
  }

  /** Failed units back to pending; a week written day by day resumes at its first missing day. */
  async retryFailed(id) {
    const job = await this._require(id);
    if (ACTIVE.includes(job.status)) throw new ConflictError('Wait for the job to finish or pause it first');
    const failed = (await repo.getUnits(id)).filter(unit => unit.status === 'failed');
    if (failed.length === 0) throw new ConflictError('No failed unit to retry');
    for (const unit of failed) await repo.updateUnit(unit.id, { status: 'pending', error: null });
    await repo.updateJob(id, { status: 'queued', finishedAt: null });
    await this.refreshCounters(id);
    await this.log(id, `Retrying ${failed.length} failed unit(s)`);
    this.onQueued();
    return this.get(id);
  }

  /** Marks every story of the job as reviewed. */
  async validate(id) {
    await this._require(id);
    const updated = await storyService.setReviewStatus(await repo.jobStoryIds(id), 'validated');
    return { updated };
  }

  /** Deletes the stories written by the job (the job and its history stay). */
  async deleteStories(id) {
    const job = await this._require(id);
    if (ACTIVE.includes(job.status)) throw new ConflictError('Pause or cancel the job before deleting its stories');
    const ids = await repo.jobStoryIds(id);
    for (const storyId of ids) await storyService.delete(storyId);
    await this.log(id, `${ids.length} story(ies) deleted`);
    return { deleted: ids.length };
  }

  /** Deletes a finished, paused or cancelled job and its units; its stories stay in the library. */
  async remove(id) {
    const job = await this._require(id);
    if (['queued', 'running'].includes(job.status)) throw new ConflictError('Pause or cancel the job before deleting it');
    await repo.deleteJob(id);
    return { deleted: true };
  }

  /**
   * A new job with the same parameters (the cells already written are skipped as usual, a regeneration rewrites
   * them again). The series of a framed job is read again from its cast.
   */
  async replay(id) {
    const job = await this._require(id);
    const { seriesId, ...params } = job.params;
    return this.create(params);
  }

  /**
   * Weeks x ages grid: stories per cell and the topic of each week.
   * @returns {Promise<{weeks: {weekNumber: number, topic: string|null}[], ages: string[], cells: Object<string, {total: number, days: number}>}>}
   */
  /**
   * @param {{series?: string|null}} [options] - series: null or 'all' (every story), 'none' (without series), a series id.
   *   A series answer also says whether it is framed and which age groups have a cast.
   */
  async coverage({ series = null } = {}) {
    const filter = series && series !== 'all' ? series : null;
    const topics = new Map((await weeklyThemeService.findAll()).map(week => [Number(week.week_number), week.theme_name]));
    const cells = {};
    for (const row of await repo.coverage('fr', filter)) {
      cells[`${row.week_number}:${row.age_group}`] = { total: Number(row.total), days: Number(row.days) };
    }
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1).map(weekNumber => ({ weekNumber, topic: topics.get(weekNumber) ?? null }));
    // Week 53 only when it has a topic
    if (topics.has(53)) weeks.push({ weekNumber: 53, topic: topics.get(53) });
    const result = { weeks, ages: AGE_GROUPS, cells };
    if (filter && filter !== 'none') {
      const { casts } = await seriesCastService.list(filter);
      const castAges = AGE_GROUPS.filter(age => casts.some(cast => cast.ageGroups.includes(age)));
      result.series = { id: filter, name: await seriesCastService.seriesName(filter), framed: casts.length > 0, castAges };
    }
    return result;
  }

  /** Recomputes the counters of a job from its units. */
  async refreshCounters(id) {
    const units = await repo.getUnits(id);
    await repo.updateJob(id, {
      totalUnits: units.length,
      doneUnits: units.filter(u => ['done', 'failed', 'skipped'].includes(u.status)).length,
      createdCount: units.reduce((total, u) => total + (u.storyIds?.length || 0), 0),
      failedCount: units.filter(u => u.status === 'failed').length,
      skippedCount: units.filter(u => u.status === 'skipped').length
    });
  }

  /** Framed job short of quota: waits for the next quota day (resumed by the worker). */
  async schedule(id, reason, now = new Date()) {
    const resumeAt = nextQuotaReset(now);
    await repo.updateJob(id, { status: 'scheduled', resumeAt: resumeAt.toISOString().slice(0, 19).replace('T', ' '), currentLabel: null });
    await this.log(id, `${reason}: scheduled, resumes at ${resumeAt.toISOString()}`);
    return resumeAt;
  }

  /** Appends a line to the job log (last 300 kept). */
  async log(id, message) {
    const job = await repo.getJob(id);
    if (!job) return;
    const log = [...(job.log || []), { at: new Date().toISOString(), message }].slice(-300);
    await repo.updateJob(id, { log });
  }

  async _require(id) {
    const job = await repo.getJob(id);
    if (!job) throw new NotFoundError('Generation job not found');
    return job;
  }
}

export const generationJobService = new GenerationJobService();
