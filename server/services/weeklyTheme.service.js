import { query } from '../config/database.js';

class WeeklyThemeService {
  async findAll() {
      return await query('SELECT * FROM weekly_themes ORDER BY week_number ASC');
  }

  async update(themes) {
      for (const theme of themes) {
          const { week_number, theme_name, theme_description } = theme;
           const existing = await query('SELECT week_number FROM weekly_themes WHERE week_number = ?', [week_number]);
           if (existing.length > 0) {
              await query('UPDATE weekly_themes SET theme_name = ?, theme_description = ? WHERE week_number = ?', [theme_name, theme_description, week_number]);
           } else {
              await query('INSERT INTO weekly_themes (week_number, theme_name, theme_description) VALUES (?, ?, ?)', [week_number, theme_name, theme_description]);
           }
      }
      return true;
  }
}
export const weeklyThemeService = new WeeklyThemeService();
