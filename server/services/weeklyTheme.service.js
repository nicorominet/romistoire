import { query } from '../config/database.js';
import { NotFoundError, ValidationError } from '../middleware/error.middleware.js';
import { themeService } from './theme.service.js';

const MAX_WEEK = 53;

/**
 * Weekly themes: each week points to a theme (weekly_themes.theme_id).
 * theme_name is kept as a fallback label for rows not linked yet.
 */
class WeeklyThemeService {
  /**
   * All configured weeks, with the linked theme's current name, color and icon.
   */
  async findAll() {
    const rows = await query(`
      SELECT w.week_number, w.theme_id,
             COALESCE(t.name, w.theme_name) AS theme_name,
             COALESCE(t.description, w.theme_description) AS theme_description,
             t.color, t.icon
      FROM weekly_themes w
      LEFT JOIN themes t ON t.id = w.theme_id
      ORDER BY w.week_number ASC
    `);
    return rows.map(row => ({
      week_number: Number(row.week_number),
      theme_id: row.theme_id || null,
      theme_name: row.theme_name,
      theme_description: row.theme_description ?? '',
      color: row.color || null,
      icon: row.icon || null
    }));
  }

  async findByWeek(weekNumber) {
    return (await this.findAll()).find(week => week.week_number === Number(weekNumber)) || null;
  }

  _checkWeek(weekNumber) {
    const week = Number(weekNumber);
    if (!Number.isInteger(week) || week < 1 || week > MAX_WEEK) {
      throw new ValidationError(`Week number must be between 1 and ${MAX_WEEK}`);
    }
    return week;
  }

  /**
   * Link a week to a theme.
   * @param {number} weekNumber
   * @param {{themeId?: string, themeName?: string}} data - An existing theme id, or a name (theme created if needed).
   */
  async setWeek(weekNumber, { themeId, themeName } = {}) {
    const week = this._checkWeek(weekNumber);

    let theme;
    if (themeId) {
      theme = await themeService.findById(themeId);
      if (!theme) throw new NotFoundError('Theme not found');
    } else if (themeName && String(themeName).trim()) {
      theme = (await themeService.create({ name: themeName })).theme;
    } else {
      throw new ValidationError('A theme is required');
    }

    await query(
      `INSERT INTO weekly_themes (week_number, theme_id, theme_name, theme_description) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE theme_id = VALUES(theme_id), theme_name = VALUES(theme_name), theme_description = VALUES(theme_description)`,
      [week, theme.id, theme.name, theme.description || null]
    );
    themeService.invalidateCache();
    return await this.findByWeek(week);
  }

  /** Remove the theme of a week. */
  async clearWeek(weekNumber) {
    const week = this._checkWeek(weekNumber);
    await query('DELETE FROM weekly_themes WHERE week_number = ?', [week]);
    return true;
  }

  /**
   * Batch update (legacy endpoint, used by imports): [{ week_number, theme_id? , theme_name }].
   */
  async update(weeks) {
    if (!Array.isArray(weeks)) throw new ValidationError('An array of weeks is expected');
    for (const week of weeks) {
      if (!week?.theme_id && !String(week?.theme_name || '').trim()) continue;
      await this.setWeek(week.week_number, { themeId: week.theme_id, themeName: week.theme_name });
    }
    return true;
  }
}

export const weeklyThemeService = new WeeklyThemeService();
