import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing themes.
 */
class ThemeService {
  constructor() {
    this.cache = null;
  }

  /**
   * Fetch all themes with optional filters.
   * Uses caching for non-filtered requests.
   * @param {string} [locale='fr'] - Locale filters (not directly applied in query logic currently but used for cache key).
   * @param {Object} [filters={}] - Filtering options.
   * @param {string} [filters.age_group] - Filter by age group.
   * @param {string} [filters.series_id] - Filter by series ID.
   * @param {string} [filters.search] - Search term.
   * @returns {Promise<Array>} List of themes with story counts.
   */
  async findAll(locale = 'fr', filters = {}) {
    const { age_group, series_id, search } = filters;
    let params = [];
    let whereClauses = [];
    let joinStories = false;

    if (age_group || series_id) {
        joinStories = true;
    }

    let sql = `
        SELECT t.*, COUNT(DISTINCT st.story_id) as story_count 
        FROM themes t 
        LEFT JOIN story_themes st ON t.id = st.theme_id 
    `;

    if (joinStories) {
        sql += ` LEFT JOIN stories s ON st.story_id = s.id `;
    }

    if (search) {
        whereClauses.push(`(t.name LIKE ? OR t.description LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`);
    }

    if (age_group) {
        whereClauses.push(`s.age_group = ?`);
        params.push(age_group);
    }

    if (series_id) {
        whereClauses.push(`s.series_id = ?`);
        params.push(series_id);
    }

    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')} `;
    }

    sql += ` GROUP BY t.id `;
    sql += ` ORDER BY t.name ASC`;

    // Cache strategy: only cache if no filters (except default locale)
    const isCacheable = !search && !age_group && !series_id;
    
    if (isCacheable && this.cache && this.cache.locale === locale) {
        return this.cache.data;
    }

    const results = await query(sql, params);

    if (isCacheable) {
        this.cache = {
            locale,
            data: results,
            timestamp: Date.now()
        };
    }

    return results;
  }

  /**
   * Get all stories associated with a theme.
   * @param {string} themeId - Theme ID.
   * @returns {Promise<Array>} List of stories.
   */
  async getStories(themeId) {
      const sql = `
        SELECT s.* 
        FROM stories s
        JOIN story_themes st ON s.id = st.story_id
        WHERE st.theme_id = ?
        ORDER BY s.title ASC
      `;
      return await query(sql, [themeId]);
  }

  /**
   * Create a new theme.
   * @param {Object} themeData - Theme data.
   * @returns {Promise<Object>} The created theme.
   */
  async create(themeData) {
      const { name, description, color, icon } = themeData;
      const existing = await query('SELECT * FROM themes WHERE name = ?', [name]);
      if (existing.length > 0) return existing[0]; // Return existing if duplicate name

      const id = uuidv4();
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      await query(
        'INSERT INTO themes (id, name, description, color, icon, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, description, color, icon || null, now]
      );
      this.invalidateCache();
      return { id, name, description, color, icon, created_at: now };
  }

  /**
   * Invalidate the theme cache.
   */
  invalidateCache() {
      this.cache = null;
  }

  /**
   * Update an existing theme.
   * @param {string} id - Theme ID.
   * @param {Object} data - Update data.
   * @returns {Promise<Object>} The updated theme.
   */
  async update(id, { name, description, color }) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query(
           'UPDATE themes SET name = ?, description = ?, color = ?, created_at = ? WHERE id = ?',
          [name, description, color, now, id]
      );
      this.invalidateCache();
      return { id, name, description, color, created_at: now };
  }

  /**
   * Delete a theme.
   * @param {string} id - Theme ID.
   * @returns {Promise<boolean>} True on success.
   * @throws {Error} If theme is associated with stories.
   */
  async delete(id) {
    const storiesUsingTheme = await query('SELECT COUNT(*) as count FROM story_themes WHERE theme_id = ?', [id]);
    if (storiesUsingTheme[0].count > 0) {
        throw new Error('Cannot delete theme. It is used by one or more stories.');
    }
    await query('DELETE FROM themes WHERE id = ?', [id]);
    this.invalidateCache();
    return true;
  }

  /**
   * Merge duplicate themes based on name.
   * @returns {Promise<{message: string}>} Result message.
   */
  async mergeDuplicates() {
      const duplicates = await query(`SELECT name, COUNT(*) as count FROM themes GROUP BY name HAVING count > 1`);
      if (duplicates.length === 0) return { message: 'No duplicate themes found' };
      
      let mergedCount = 0;
      for (const row of duplicates) {
          const themes = await query('SELECT * FROM themes WHERE name = ?', [row.name]);
          if (themes.length > 1) {
              const [primary, ...others] = themes;
              for (const other of others) {
                  await query('UPDATE story_themes SET theme_id = ? WHERE theme_id = ?', [primary.id, other.id]);
                  await query('DELETE FROM themes WHERE id = ?', [other.id]);
              }
              mergedCount++;
          }
      }
      if (mergedCount > 0) this.invalidateCache();
      return { message: `Merged ${mergedCount} duplicate groups` };
  }

  /**
   * Update stories to replace an old theme ID with a new one.
   * @param {string} oldThemeId - Old Theme ID.
   * @param {string} newThemeId - New Theme ID.
   * @returns {Promise<boolean>} True on success.
   */
  async updateStoriesTheme(oldThemeId, newThemeId) {
      const connection = await getConnection();
      try {
          await connection.beginTransaction();
          await connection.query('UPDATE stories SET theme_id = ? WHERE theme_id = ?', [newThemeId, oldThemeId]);
          await connection.commit();
          return true;
      } catch (error) {
          await connection.rollback();
          throw error;
      } finally {
          connection.release();
      }
  }
}
export const themeService = new ThemeService();
