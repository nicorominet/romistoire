import { query, getConnection } from '../config/database.js';

/**
 * Service for managing weekly themes configuration.
 */
class WeeklyThemeService {
  /**
   * Fetch all weekly themes.
   * @returns {Promise<Array>} List of weekly themes.
   */
  async findAll() {
      return await query('SELECT * FROM weekly_themes ORDER BY week_number ASC');
  }

  /**
   * Update weekly themes configuration.
   * Creates new entries or updates existing ones.
   * @param {Array} themes - List of weekly theme objects.
   * @returns {Promise<boolean>} True on success.
   */
  async update(themes) {
      const connection = await getConnection();
      try {
          await connection.beginTransaction();
          for (const theme of themes) {
              const { week_number, theme_name, theme_description } = theme;
               const [existing] = await connection.query('SELECT week_number FROM weekly_themes WHERE week_number = ?', [week_number]);
               if (existing.length > 0) {
                  await connection.query('UPDATE weekly_themes SET theme_name = ?, theme_description = ? WHERE week_number = ?', [theme_name, theme_description, week_number]);
               } else {
                  await connection.query('INSERT INTO weekly_themes (week_number, theme_name, theme_description) VALUES (?, ?, ?)', [week_number, theme_name, theme_description]);
               }
          }
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
export const weeklyThemeService = new WeeklyThemeService();
