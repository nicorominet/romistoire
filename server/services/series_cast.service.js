import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { NotFoundError, ValidationError } from '../middleware/error.middleware.js';
import { normalizeCast, validateCast } from './helpers/cast_validation.helper.js';

/**
 * Bible of a framed series (generation tab "Génération cadrée"): its casts (one per set of age groups),
 * the facts its weeks establish, and the recap and audit of each week.
 * The free generation never reads it.
 */

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/** JSON columns come back as strings (MariaDB) or objects (MySQL). */
const parseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (e) { return fallback; }
};

const toCast = (row) => row && ({
  id: row.id,
  seriesId: row.series_id,
  name: row.name,
  ageGroups: parseJson(row.age_groups, []),
  universe: row.universe || '',
  rules: parseJson(row.rules, []),
  characters: parseJson(row.characters, []),
  referenceWeek: Number(row.reference_week || 1),
  version: Number(row.version || 1),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toFact = (row) => ({
  id: row.id,
  castId: row.cast_id,
  ageGroup: row.age_group,
  weekNumber: Number(row.week_number),
  text: row.text,
  status: row.status,
  sourceStoryId: row.source_story_id,
  createdAt: row.created_at
});

const toRecap = (row) => ({
  ageGroup: row.age_group,
  weekNumber: Number(row.week_number),
  recap: row.recap || '',
  audit: parseJson(row.audit, null),
  stale: Boolean(Number(row.stale)),
  updatedAt: row.updated_at
});

const FACT_STATUSES = ['proposed', 'approved', 'rejected'];
/** Weeks of memory given to a new week: the last ones before it, by week number. */
export const RECAP_WEEKS = 4;
const FACT_MAX = 500;

class SeriesCastService {
  async _requireSeries(seriesId) {
    const rows = await query('SELECT id, character_sheet FROM story_series WHERE id = ?', [seriesId]);
    if (!rows || rows.length === 0) throw new NotFoundError('Series not found');
    return rows[0];
  }

  async seriesName(seriesId) {
    const [row] = await query('SELECT name FROM story_series WHERE id = ?', [seriesId]);
    if (!row) throw new NotFoundError('Series not found');
    return row.name;
  }

  /** Casts of a series, and the old automatic sheet so a first cast can start from it. */
  async list(seriesId) {
    const series = await this._requireSeries(seriesId);
    const rows = await query('SELECT * FROM series_casts WHERE series_id = ? ORDER BY created_at ASC', [seriesId]);
    return { casts: rows.map(toCast), legacySheet: series.character_sheet || '' };
  }

  async get(castId) {
    const [row] = await query('SELECT * FROM series_casts WHERE id = ?', [castId]);
    if (!row) throw new NotFoundError('Cast not found');
    return toCast(row);
  }

  /**
   * Casts of several series at once (illustration list).
   * @param {string[]} seriesIds
   * @returns {Promise<Object[]>}
   */
  async castsOfSeries(seriesIds) {
    const ids = [...new Set((seriesIds || []).filter(Boolean))];
    if (ids.length === 0) return [];
    const rows = await query(`SELECT * FROM series_casts WHERE series_id IN (${ids.map(() => '?').join(',')})`, ids);
    return rows.map(toCast);
  }

  /**
   * Names the heroes of a cast must not take: the other series and the characters of their casts.
   * @returns {Promise<string[]>}
   */
  async reservedNames(seriesId) {
    const series = await query('SELECT name FROM story_series WHERE id <> ?', [seriesId]);
    const casts = await query('SELECT characters FROM series_casts WHERE series_id <> ?', [seriesId]);
    return [
      ...series.map(row => row.name),
      ...casts.flatMap(row => parseJson(row.characters, []).map(character => character.name))
    ].filter(Boolean);
  }

  /**
   * Cleans and checks a cast without saving it.
   * @param {{castId?: string, weeks?: number[]}} [options] - castId: the cast being edited (its own age groups are free).
   * @returns {Promise<{cast: Object, errors: Object[], warnings: Object[]}>}
   */
  async validate(seriesId, input, { castId = null, weeks = [] } = {}) {
    await this._requireSeries(seriesId);
    const cast = normalizeCast(input);
    const others = (await query('SELECT id, age_groups FROM series_casts WHERE series_id = ?', [seriesId]))
      .filter(row => row.id !== castId);
    const { errors, warnings } = validateCast(cast, {
      reservedNames: await this.reservedNames(seriesId),
      takenAgeGroups: others.flatMap(row => parseJson(row.age_groups, [])),
      weeks
    });
    return { cast, errors, warnings };
  }

  async create(seriesId, input) {
    const { cast, errors, warnings } = await this.validate(seriesId, input);
    if (errors.length) throw new ValidationError('The cast is not consistent', { errors, warnings });
    const id = uuidv4();
    const at = now();
    await query(
      `INSERT INTO series_casts (id, series_id, name, age_groups, universe, rules, characters, reference_week, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, seriesId, cast.name, JSON.stringify(cast.ageGroups), cast.universe || null, JSON.stringify(cast.rules),
        JSON.stringify(cast.characters), cast.referenceWeek, at, at]
    );
    return { cast: await this.get(id), warnings };
  }

  /** Saves a new version of a cast (the weeks already written keep their text; their audit compares to the new sheet). */
  async update(castId, input) {
    const current = await this.get(castId);
    const { cast, errors, warnings } = await this.validate(current.seriesId, input, { castId });
    if (errors.length) throw new ValidationError('The cast is not consistent', { errors, warnings });
    await query(
      `UPDATE series_casts SET name = ?, age_groups = ?, universe = ?, rules = ?, characters = ?, reference_week = ?,
       version = version + 1, updated_at = ? WHERE id = ?`,
      [cast.name, JSON.stringify(cast.ageGroups), cast.universe || null, JSON.stringify(cast.rules),
        JSON.stringify(cast.characters), cast.referenceWeek, now(), castId]
    );
    return { cast: await this.get(castId), warnings };
  }

  async delete(castId) {
    await this.get(castId);
    await query('DELETE FROM series_casts WHERE id = ?', [castId]);
    return true;
  }

  // --- Facts: what the weeks of an age group establish (a pet adopted, a move), proposed by the audit, approved by the user ---

  async listFacts(castId) {
    const rows = await query('SELECT * FROM series_facts WHERE cast_id = ? ORDER BY age_group ASC, week_number ASC, created_at ASC', [castId]);
    return rows.map(toFact);
  }

  /** Approved facts of the weeks before a week, for an age group: they hold for it. */
  async factsBefore(castId, ageGroup, weekNumber) {
    const rows = await query(
      "SELECT * FROM series_facts WHERE cast_id = ? AND age_group = ? AND status = 'approved' AND week_number < ? ORDER BY week_number ASC",
      [castId, ageGroup, weekNumber]
    );
    return rows.map(toFact);
  }

  async addFact(castId, { ageGroup, weekNumber, text, status = 'approved', sourceStoryId = null }) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, FACT_MAX);
    if (!clean) throw new ValidationError('A fact needs a text');
    const week = Number(weekNumber);
    if (!Number.isInteger(week) || week < 1 || week > 53) throw new ValidationError('Invalid week');
    if (!FACT_STATUSES.includes(status)) throw new ValidationError('Invalid status');
    const cast = await this.get(castId);
    if (!cast.ageGroups.includes(ageGroup)) throw new ValidationError('This age group is not in the cast');
    const id = uuidv4();
    await query(
      'INSERT INTO series_facts (id, cast_id, age_group, week_number, text, status, source_story_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, castId, ageGroup, week, clean, status, sourceStoryId, now()]
    );
    return { id, castId, ageGroup, weekNumber: week, text: clean, status, sourceStoryId };
  }

  async setFactStatus(factId, status) {
    if (!FACT_STATUSES.includes(status)) throw new ValidationError('Invalid status');
    const result = await query('UPDATE series_facts SET status = ? WHERE id = ?', [status, factId]);
    if (!result?.affectedRows) throw new NotFoundError('Fact not found');
    return { id: factId, status };
  }

  async deleteFact(factId) {
    await query('DELETE FROM series_facts WHERE id = ?', [factId]);
    return true;
  }

  /** Facts proposed by the audit of a week: the previous proposals of that week are replaced (a week audited again). */
  async replaceProposedFacts(castId, ageGroup, weekNumber, texts) {
    await query("DELETE FROM series_facts WHERE cast_id = ? AND age_group = ? AND week_number = ? AND status = 'proposed'", [castId, ageGroup, weekNumber]);
    for (const text of (texts || []).slice(0, 10)) {
      if (String(text || '').trim()) await this.addFact(castId, { ageGroup, weekNumber, text, status: 'proposed' });
    }
  }

  // --- Recaps and audits of the weeks, per age group ---

  async listRecaps(castId) {
    const rows = await query('SELECT * FROM series_week_recaps WHERE cast_id = ? ORDER BY age_group ASC, week_number ASC', [castId]);
    return rows.map(toRecap);
  }

  async getRecap(castId, ageGroup, weekNumber) {
    const [row] = await query('SELECT * FROM series_week_recaps WHERE cast_id = ? AND age_group = ? AND week_number = ?', [castId, ageGroup, weekNumber]);
    return row ? toRecap(row) : null;
  }

  /** Recaps of the last weeks before a week (by week number, whatever the order they were written in). */
  async recapsBefore(castId, ageGroup, weekNumber, limit = RECAP_WEEKS) {
    const rows = await query(
      `SELECT * FROM series_week_recaps WHERE cast_id = ? AND age_group = ? AND week_number < ? AND recap IS NOT NULL AND recap <> ''
       ORDER BY week_number DESC LIMIT ?`,
      [castId, ageGroup, weekNumber, String(limit)]
    );
    return rows.map(toRecap).reverse();
  }

  /** Recap and audit of a week; the week is no longer stale. */
  async saveRecap(castId, ageGroup, weekNumber, { recap = null, audit = null }) {
    await query(
      `INSERT INTO series_week_recaps (cast_id, age_group, week_number, recap, audit, stale, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE recap = VALUES(recap), audit = VALUES(audit), stale = 0, updated_at = VALUES(updated_at)`,
      [castId, ageGroup, weekNumber, recap, audit ? JSON.stringify(audit) : null, now()]
    );
  }

  /** A week rewritten: the weeks after it, already written, may contradict it now. */
  async markStaleAfter(castId, ageGroup, weekNumber) {
    const result = await query(
      'UPDATE series_week_recaps SET stale = 1 WHERE cast_id = ? AND age_group = ? AND week_number > ?',
      [castId, ageGroup, weekNumber]
    );
    return result?.affectedRows || 0;
  }
}

export const seriesCastService = new SeriesCastService();
