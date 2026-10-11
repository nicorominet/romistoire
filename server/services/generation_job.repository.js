import { query } from '../config/database.js';

/**
 * Database access of the mass generation jobs (generation_jobs, generation_units).
 * Kept apart from the job logic so the worker can be tested with an in-memory store.
 */

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/** JSON columns come back as strings (MariaDB) or objects (MySQL). */
const parseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (e) { return fallback; }
};

const toJob = (row) => row && ({
  id: row.id,
  status: row.status,
  params: parseJson(row.params, {}),
  totalUnits: Number(row.total_units),
  doneUnits: Number(row.done_units),
  createdCount: Number(row.created_count),
  failedCount: Number(row.failed_count),
  skippedCount: Number(row.skipped_count),
  currentLabel: row.current_label,
  provider: row.provider,
  model: row.model,
  log: parseJson(row.log, []),
  createdAt: row.created_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  resumeAt: row.resume_at ?? null,
  budgetDay: row.budget_day ?? null,
  budgetUsed: Number(row.budget_used ?? 0)
});

const toUnit = (row) => row && ({
  id: row.id,
  jobId: row.job_id,
  position: Number(row.position),
  weekNumber: Number(row.week_number),
  ageGroup: row.age_group,
  day: row.day,
  status: row.status,
  context: parseJson(row.context, null),
  storyIds: parseJson(row.story_ids, []),
  error: row.error,
  attempts: Number(row.attempts),
  model: row.model,
  updatedAt: row.updated_at
});

const JOB_COLUMNS = {
  status: 'status', totalUnits: 'total_units', doneUnits: 'done_units', createdCount: 'created_count',
  failedCount: 'failed_count', skippedCount: 'skipped_count', currentLabel: 'current_label', model: 'model',
  log: 'log', startedAt: 'started_at', finishedAt: 'finished_at',
  resumeAt: 'resume_at', budgetDay: 'budget_day', budgetUsed: 'budget_used'
};
const UNIT_COLUMNS = {
  status: 'status', context: 'context', storyIds: 'story_ids', error: 'error', attempts: 'attempts', model: 'model'
};
const JSON_FIELDS = new Set(['log', 'context', 'storyIds']);

const buildSet = (columns, changes) => {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(changes)) {
    if (!(key in columns)) continue;
    sets.push(`${columns[key]} = ?`);
    params.push(JSON_FIELDS.has(key) && value !== null ? JSON.stringify(value) : value);
  }
  return { sets, params };
};

export const generationJobRepository = {
  now,

  async insertJob({ id, params, provider, model, units }) {
    await query(
      `INSERT INTO generation_jobs (id, status, params, total_units, provider, model, log, created_at)
       VALUES (?, 'queued', ?, ?, ?, ?, ?, ?)`,
      [id, JSON.stringify(params), units.length, provider, model ?? null, JSON.stringify([]), now()]
    );
    for (const unit of units) {
      await query(
        `INSERT INTO generation_units (id, job_id, position, week_number, age_group, day, status, error, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [unit.id, id, unit.position, unit.weekNumber, unit.ageGroup, unit.day, unit.status, unit.error ?? null, now()]
      );
    }
  },

  async getJob(id) {
    const [row] = await query('SELECT * FROM generation_jobs WHERE id = ?', [id]);
    return toJob(row) || null;
  },

  async listJobs(limit = 50) {
    const rows = await query('SELECT * FROM generation_jobs ORDER BY created_at DESC LIMIT ?', [String(limit)]);
    return rows.map(toJob);
  },

  async updateJob(id, changes) {
    const { sets, params } = buildSet(JOB_COLUMNS, changes);
    if (sets.length === 0) return;
    await query(`UPDATE generation_jobs SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  },

  async getUnits(jobId) {
    const rows = await query('SELECT * FROM generation_units WHERE job_id = ? ORDER BY position ASC', [jobId]);
    return rows.map(toUnit);
  },

  async updateUnit(id, changes) {
    const { sets, params } = buildSet(UNIT_COLUMNS, changes);
    if (sets.length === 0) return;
    await query(`UPDATE generation_units SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [...params, now(), id]);
  },

  /** Oldest job waiting to run. */
  async nextQueuedJob() {
    const [row] = await query("SELECT * FROM generation_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1");
    return toJob(row) || null;
  },

  /** Scheduled jobs whose quota day has come back to the queue. */
  async promoteDueScheduled() {
    const result = await query("UPDATE generation_jobs SET status = 'queued', resume_at = NULL WHERE status = 'scheduled' AND resume_at <= ?", [now()]);
    return result?.affectedRows ?? 0;
  },

  /** After a restart: jobs that were running go back to the queue, their running unit back to pending. */
  async requeueInterrupted() {
    await query("UPDATE generation_units SET status = 'pending' WHERE status = 'running'");
    const result = await query("UPDATE generation_jobs SET status = 'queued' WHERE status = 'running'");
    return result?.affectedRows ?? 0;
  },

  /** Stories already written for a (week, age) cell, in day order. */
  async existingStories(weekNumber, ageGroup, locale = 'fr') {
    return query(
      `SELECT s.id, s.title, s.content, s.summary, s.illustration_prompt, s.day_order, ss.name AS series_name
       FROM stories s LEFT JOIN story_series ss ON ss.id = s.series_id
       WHERE s.week_number = ? AND s.age_group = ? AND s.locale = ? ORDER BY s.day_order ASC`,
      [weekNumber, ageGroup, locale]
    );
  },

  /** Number of stories per (week, age) cell. */
  async coverage(locale = 'fr') {
    return query(
      'SELECT week_number, age_group, COUNT(*) AS total, COUNT(DISTINCT day_order) AS days FROM stories WHERE locale = ? GROUP BY week_number, age_group',
      [locale]
    );
  },

  /**
   * Most recent titles of a series for an age group (stories without series when no name is given).
   * @returns {Promise<string[]>}
   */
  async recentTitles({ seriesName, ageGroup, limit = 60 }) {
    const rows = seriesName
      ? await query(
        `SELECT s.title FROM stories s JOIN story_series ss ON ss.id = s.series_id
         WHERE ss.name = ? AND s.age_group = ? ORDER BY s.created_at DESC LIMIT ?`,
        [seriesName, ageGroup, String(limit)])
      : await query(
        'SELECT title FROM stories WHERE series_id IS NULL AND age_group = ? ORDER BY created_at DESC LIMIT ?',
        [ageGroup, String(limit)]);
    return rows.map(row => row.title);
  },

  /**
   * Titles to avoid for a new story: those of its series first, then the whole library (same age group first),
   * as the same title came back in other series and ages ("Le festin des oiseaux" 3 times).
   * @returns {Promise<string[]>} Unique titles, most relevant first.
   */
  async titlesToAvoid({ seriesName, ageGroup, limit = 150 }) {
    const series = await this.recentTitles({ seriesName, ageGroup });
    const library = await query(
      'SELECT title FROM stories ORDER BY (age_group = ?) DESC, created_at DESC LIMIT ?',
      [ageGroup, String(limit)]);
    return [...new Set([...series, ...library.map(row => row.title)])];
  },

  /** Names of the series: their heroes' names, kept out of the other stories. */
  async seriesNames() {
    const rows = await query('SELECT name FROM story_series');
    // Heroes of the framed series (their bible): kept out of the other stories too
    const casts = await query('SELECT characters FROM series_casts');
    const heroes = casts.flatMap(row => parseJson(row.characters, []).map(character => character?.name)).filter(Boolean);
    return [...new Set([...rows.map(row => row.name), ...heroes])];
  },

  /**
   * Fixed sheet of a series: the description written by the user, then the character sheet of its first week.
   * @returns {Promise<string>} "" for no series or no sheet.
   */
  async seriesSheet(seriesName) {
    if (!seriesName) return '';
    const [row] = await query('SELECT description, character_sheet FROM story_series WHERE name = ? LIMIT 1', [seriesName]);
    return [row?.description, row?.character_sheet].map(text => String(text || '').trim()).filter(Boolean).join(' ');
  },

  /** Keeps the first character sheet of a series (never overwrites one). */
  async saveSeriesSheet(seriesName, sheet) {
    if (!seriesName || !sheet) return;
    await query('UPDATE story_series SET character_sheet = ? WHERE name = ? AND (character_sheet IS NULL OR character_sheet = \'\')', [sheet, seriesName]);
  },

  async jobStoryIds(jobId) {
    const rows = await query('SELECT id FROM stories WHERE generation_job_id = ?', [jobId]);
    return rows.map(row => row.id);
  }
};
