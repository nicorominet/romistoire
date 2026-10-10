import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/error.middleware.js';
import { normalizeThemeName, groupSimilarThemes } from './helpers/theme_name.helper.js';
import { mergeThemesOnConnection } from './helpers/theme_merge.helper.js';

const NAME_MAX_LENGTH = 100;
const ICON_MAX_LENGTH = 16;
const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_COLOR = '#6366f1';
const SORTS = {
  name: 't.name ASC',
  usage: 'storyCount DESC, t.name ASC',
  recent: 'COALESCE(t.updated_at, t.created_at) DESC, t.name ASC'
};

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const THEME_SELECT = `
  SELECT t.id, t.name, t.description, t.icon, t.color, t.source, t.needs_review, t.created_at, t.updated_at,
         (SELECT COUNT(*) FROM story_themes st WHERE st.theme_id = t.id) AS storyCount
  FROM themes t`;

/** DB row -> API object. */
const toTheme = (row) => row && ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  icon: row.icon || null,
  color: row.color || DEFAULT_COLOR,
  source: row.source || 'manual',
  needsReview: Number(row.needs_review) === 1,
  storyCount: Number(row.storyCount || 0),
  created_at: row.created_at,
  updated_at: row.updated_at || null
});

/**
 * Validates and cleans theme fields. Only the provided fields are returned (partial updates).
 * @throws {ValidationError}
 */
const cleanThemeInput = (data, { requireName }) => {
  const clean = {};
  if (data.name !== undefined || requireName) {
    const name = String(data.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) throw new ValidationError('Theme name is required');
    if (name.length > NAME_MAX_LENGTH) throw new ValidationError(`Theme name is limited to ${NAME_MAX_LENGTH} characters`);
    if (!normalizeThemeName(name)) throw new ValidationError('Theme name must contain letters or digits');
    clean.name = name;
  }
  if (data.description !== undefined) clean.description = String(data.description ?? '').trim();
  if (data.color !== undefined) {
    if (data.color && !COLOR_PATTERN.test(data.color)) throw new ValidationError('Color must be a hex code like #4CAF50');
    clean.color = data.color || DEFAULT_COLOR;
  }
  if (data.icon !== undefined) {
    const icon = String(data.icon ?? '').trim();
    if ([...icon].length > ICON_MAX_LENGTH) throw new ValidationError('Icon is too long');
    clean.icon = icon || null;
  }
  return clean;
};

/**
 * Service for managing themes. All theme rules (uniqueness, merge, delete) live here.
 */
class ThemeService {
  constructor() {
    this.cache = null;
  }

  invalidateCache() {
    this.cache = null;
  }

  /**
   * List themes with their story count.
   * @param {Object} [filters]
   * @param {string} [filters.search] - Matches name or description (accents and case ignored on the name).
   * @param {'name'|'usage'|'recent'} [filters.sort='name']
   * @param {boolean} [filters.needsReview] - Only AI themes not reviewed yet.
   * @param {boolean} [filters.unused] - Only themes without stories.
   */
  async findAll({ search, sort = 'name', needsReview = false, unused = false } = {}) {
    const isDefault = !search && sort === 'name' && !needsReview && !unused;
    if (isDefault && this.cache) return this.cache;

    const where = [];
    const params = [];
    if (search && String(search).trim()) {
      const term = String(search).trim();
      where.push('(t.normalized_name LIKE ? OR t.name LIKE ? OR t.description LIKE ?)');
      params.push(`%${normalizeThemeName(term) || term}%`, `%${term}%`, `%${term}%`);
    }
    if (needsReview) where.push('t.needs_review = TRUE');

    let sql = THEME_SELECT;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    if (unused) sql += ' HAVING storyCount = 0';
    sql += ` ORDER BY ${SORTS[sort] || SORTS.name}`;

    const themes = (await query(sql, params)).map(toTheme);
    if (isDefault) this.cache = themes;
    return themes;
  }

  async findById(id, connection = null) {
    const sql = `${THEME_SELECT} WHERE t.id = ?`;
    const rows = connection ? (await connection.query(sql, [id]))[0] : await query(sql, [id]);
    return toTheme(rows[0]) || null;
  }

  async _findByNormalizedName(normalizedName, connection = null) {
    const sql = `${THEME_SELECT} WHERE t.normalized_name = ?`;
    const rows = connection ? (await connection.query(sql, [normalizedName]))[0] : await query(sql, [normalizedName]);
    return toTheme(rows[0]) || null;
  }

  /**
   * Stories linked to a theme (light columns, for the expandable list of the themes page).
   */
  async getStories(themeId) {
    return await query(
      `SELECT s.id, s.title, s.age_group, s.week_number, s.day_order, s.locale
       FROM stories s JOIN story_themes st ON s.id = st.story_id
       WHERE st.theme_id = ? ORDER BY s.week_number, s.day_order, s.title`,
      [themeId]
    );
  }

  /**
   * Create a theme, or return the existing one with the same name (accents, case and articles ignored).
   * @param {Object} data - { name, description?, color?, icon?, source?: 'manual'|'ai' }
   * @param {Object} [connection] - Optional connection (inside a transaction).
   * @returns {Promise<{theme: Object, existing: boolean}>}
   */
  async create(data, connection = null) {
    const clean = cleanThemeInput(data, { requireName: true });
    const normalizedName = normalizeThemeName(clean.name);

    const existing = await this._findByNormalizedName(normalizedName, connection);
    if (existing) return { theme: existing, existing: true };

    const id = uuidv4();
    const source = data.source === 'ai' ? 'ai' : 'manual';
    const params = [id, clean.name, normalizedName, clean.description ?? '', clean.color ?? DEFAULT_COLOR, clean.icon ?? null, source, source === 'ai', now()];
    const sql = 'INSERT INTO themes (id, name, normalized_name, description, color, icon, source, needs_review, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    try {
      if (connection) await connection.query(sql, params);
      else await query(sql, params);
    } catch (error) {
      // Created concurrently (unique index on normalized_name)
      if (error.code === 'ER_DUP_ENTRY') {
        return { theme: await this._findByNormalizedName(normalizedName, connection), existing: true };
      }
      throw error;
    }
    this.invalidateCache();
    return { theme: await this.findById(id, connection), existing: false };
  }

  /**
   * Partial update. A human edit marks the theme as reviewed.
   * @throws {NotFoundError} Unknown theme.
   * @throws {ConflictError} Another theme already has this name ({ conflictWith }).
   */
  async update(id, patch) {
    const current = await this.findById(id);
    if (!current) throw new NotFoundError('Theme not found');

    const clean = cleanThemeInput(patch, { requireName: false });
    const sets = [];
    const params = [];

    if (clean.name !== undefined) {
      const normalizedName = normalizeThemeName(clean.name);
      const other = await this._findByNormalizedName(normalizedName);
      if (other && other.id !== id) {
        throw new ConflictError('Another theme already has this name', { conflictWith: { id: other.id, name: other.name } });
      }
      sets.push('name = ?', 'normalized_name = ?');
      params.push(clean.name, normalizedName);
    }
    for (const field of ['description', 'color', 'icon']) {
      if (clean[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(clean[field]);
      }
    }
    sets.push('needs_review = FALSE', 'updated_at = ?');
    params.push(now(), id);

    await query(`UPDATE themes SET ${sets.join(', ')} WHERE id = ?`, params);
    this.invalidateCache();
    return await this.findById(id);
  }

  /**
   * Delete a theme. A theme used by stories needs a replacement theme (`reassignTo`).
   * @throws {NotFoundError|ConflictError|ValidationError}
   */
  async delete(id, { reassignTo = null } = {}) {
    const theme = await this.findById(id);
    if (!theme) throw new NotFoundError('Theme not found');
    if (theme.storyCount > 0 && !reassignTo) {
      throw new ConflictError('Theme is used by stories', { storyCount: theme.storyCount });
    }
    if (reassignTo) {
      await this.mergeThemes([id], reassignTo);
      return { deleted: true, movedStories: theme.storyCount };
    }

    await query('DELETE FROM themes WHERE id = ?', [id]);
    this.invalidateCache();
    return { deleted: true, movedStories: 0 };
  }

  /**
   * Delete several unused themes at once. Themes still used by stories are skipped, never reassigned.
   * @param {string[]} ids
   * @returns {Promise<{deleted: string[], skipped: {id: string, storyCount: number}[]}>}
   * @throws {ValidationError} Empty list.
   */
  async deleteMany(ids) {
    const unique = Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === 'string' && id))] : [];
    if (unique.length === 0) throw new ValidationError('A non-empty list of theme ids is expected');

    const placeholders = unique.map(() => '?').join(', ');
    const result = await this._inTransaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT t.id, (SELECT COUNT(*) FROM story_themes st WHERE st.theme_id = t.id) AS storyCount
         FROM themes t WHERE t.id IN (${placeholders}) FOR UPDATE`,
        unique
      );
      const deleted = rows.filter(row => Number(row.storyCount) === 0).map(row => row.id);
      const skipped = rows.filter(row => Number(row.storyCount) > 0).map(row => ({ id: row.id, storyCount: Number(row.storyCount) }));
      if (deleted.length > 0) {
        await connection.query(`DELETE FROM themes WHERE id IN (${deleted.map(() => '?').join(', ')})`, deleted);
      }
      return { deleted, skipped };
    });
    if (result.deleted.length > 0) this.invalidateCache();
    return result;
  }

  /**
   * Mark several AI-created themes as reviewed without changing their content.
   * @param {string[]} ids
   * @returns {Promise<number>} Number of themes newly validated.
   * @throws {ValidationError} Empty list.
   */
  async approveMany(ids) {
    const unique = Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === 'string' && id))] : [];
    if (unique.length === 0) throw new ValidationError('A non-empty list of theme ids is expected');

    const result = await query(
      `UPDATE themes SET needs_review = FALSE, updated_at = ?
       WHERE needs_review = TRUE AND id IN (${unique.map(() => '?').join(', ')})`,
      [now(), ...unique]
    );
    // query() returns the result header itself (not mysql2's [result, fields] pair)
    const validated = Number(result?.affectedRows || 0);
    if (validated > 0) this.invalidateCache();
    return validated;
  }

  /**
   * Merge themes into one. Story and version links and primary flags are kept.
   * @throws {ValidationError|NotFoundError}
   */
  async mergeThemes(sourceIds, targetId) {
    const sources = [...new Set((sourceIds || []).filter(Boolean))].filter(sourceId => sourceId !== targetId);
    if (!targetId || sources.length === 0) throw new ValidationError('A target theme and at least one other theme are required');

    const target = await this.findById(targetId);
    if (!target) throw new NotFoundError('Target theme not found');

    const result = await this._inTransaction(connection => mergeThemesOnConnection(connection, sources, targetId));
    this.invalidateCache();
    return { ...result, target: await this.findById(targetId) };
  }

  /**
   * Groups of themes that look like duplicates ("Océan" / "les océans"), most used first.
   */
  async findDuplicateGroups() {
    const themes = (await query(THEME_SELECT)).map(toTheme);
    return groupSimilarThemes(themes)
      .map(group => group.sort((a, b) => b.storyCount - a.storyCount || a.name.localeCompare(b.name)));
  }

  async _inTransaction(work) {
    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const themeService = new ThemeService();
