import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/error.middleware.js';
import { generationJobRepository as repo } from './generation_job.repository.js';
import { weeklyThemeService } from './weeklyTheme.service.js';
import { storyService } from './story.service.js';
import { defaultProvider, PROVIDERS } from './settings.service.js';
import { ALL_WEEK } from './helpers/prompt.helper.js';
import { GENERATION_DAYS_FR, GENERATION_MIN_INTERVAL_MS, WEEK_STORY_COUNT, requestsPerUnit } from './helpers/generation_plan.helper.js';
import { geminiConfig } from './gemini.service.js';
import { aiUsageService } from './ai_usage.service.js';

export const AGE_GROUPS = ['2-3', '4-6', '7-9', '10-12', '13-15', '16-18'];
const MAX_WEEK = 53;
/** A job is limited to 53 weeks x 6 ages. */
const MAX_UNITS = MAX_WEEK * AGE_GROUPS.length;

/** Rough length of one request, for the estimate shown before launching (seconds). */
const ESTIMATED_SECONDS = { gemini: 25, local: 90 };

const ACTIVE = ['queued', 'running'];
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

  return {
    weeks,
    ages,
    day,
    numCharacters,
    charNames: String(input.charNames ?? '').trim().slice(0, 500),
    seriesName: String(input.seriesName ?? '').trim().slice(0, 255),
    provider,
    model: input.model ? String(input.model).trim().slice(0, 100) : null,
    skipExisting: input.skipExisting !== false
  };
};

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
  let position = 0;
  const missingTopics = new Set();

  for (const weekNumber of params.weeks) {
    for (const ageGroup of params.ages) {
      const unit = { id: uuidv4(), position: position++, weekNumber, ageGroup, day: params.day, status: 'pending', error: null };
      units.push(unit);
      if (!topics.has(weekNumber)) {
        unit.status = 'skipped';
        unit.error = 'No topic for this week';
        missingTopics.add(weekNumber);
        continue;
      }
      const done = params.skipExisting ? writtenDays(await repo.existingStories(weekNumber, ageGroup)) : new Set();
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
    }
  }
  return { units, requests, skipped: units.filter(u => u.status === 'skipped').length, missingTopics: [...missingTopics] };
};

/** Seconds for `requests` calls: the model time, at least the pacing interval for the cloud. */
const estimateSeconds = (requests, provider) =>
  requests * Math.max(ESTIMATED_SECONDS[provider] ?? 30, provider === 'local' ? 0 : GENERATION_MIN_INTERVAL_MS / 1000);

class GenerationJobService {
  constructor() {
    /** Set by the worker module (avoids an import cycle): wakes the worker up. */
    this.onQueued = () => {};
  }

  /** What a job would do, without creating it. */
  async estimate(input) {
    const params = normalizeJobParams(input);
    const { units, requests, skipped, missingTopics } = await planJob(params);
    // Free tier: requests left today on the fast models; Gemma (slow, last resort) is left out
    const fastModels = (params.model ? [params.model] : geminiConfig().models).filter(model => !model.startsWith('gemma-'));
    const remainingRequests = params.provider === 'gemini' ? await aiUsageService.remainingToday(fastModels) : null;
    return {
      units: units.length,
      toGenerate: units.length - skipped,
      skipped,
      missingTopics,
      requests,
      estimatedSeconds: estimateSeconds(requests, params.provider),
      remainingRequests,
      quotaWarning: remainingRequests !== null && requests > remainingRequests
    };
  }

  async create(input) {
    const params = normalizeJobParams(input);
    const { units } = await planJob(params);
    if (units.length > MAX_UNITS) throw new ValidationError('Too many units');
    if (units.every(unit => unit.status === 'skipped')) {
      throw new ValidationError('Nothing to generate: every selected week is already written or has no topic');
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

  async resume(id) {
    const job = await this._require(id);
    if (job.status !== 'paused') throw new ConflictError('Only a paused job can be resumed');
    await repo.updateJob(id, { status: 'queued', finishedAt: null });
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

  /**
   * Weeks x ages grid: stories per cell and the topic of each week.
   * @returns {Promise<{weeks: {weekNumber: number, topic: string|null}[], ages: string[], cells: Object<string, {total: number, days: number}>}>}
   */
  async coverage() {
    const topics = new Map((await weeklyThemeService.findAll()).map(week => [Number(week.week_number), week.theme_name]));
    const cells = {};
    for (const row of await repo.coverage()) {
      cells[`${row.week_number}:${row.age_group}`] = { total: Number(row.total), days: Number(row.days) };
    }
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1).map(weekNumber => ({ weekNumber, topic: topics.get(weekNumber) ?? null }));
    // Week 53 only when it has a topic
    if (topics.has(53)) weeks.push({ weekNumber: 53, topic: topics.get(53) });
    return { weeks, ages: AGE_GROUPS, cells };
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
