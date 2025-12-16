import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class SeriesService {
  async findAll() {
      // Need story count?
      // Old route: SELECT s.*, COUNT(st.id) as storyCount FROM story_series s LEFT JOIN stories st ON s.id = st.series_id GROUP BY s.id
      return await query(`
        SELECT ss.*, COUNT(s.id) as storyCount 
        FROM story_series ss 
        LEFT JOIN stories s ON ss.id = s.series_id 
        GROUP BY ss.id 
        ORDER BY ss.created_at DESC
      `);
  }

  async create({ name, description }) {
      const id = uuidv4();
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query('INSERT INTO story_series (id, name, description, created_at) VALUES (?, ?, ?, ?)', [id, name, description || null, now]);
      return { id, name, description, created_at: now, storyCount: 0 };
  }

  async update(id, { name, description }) {
      await query('UPDATE story_series SET name = ?, description = ? WHERE id = ?', [name, description, id]);
      return { id, name, description };
  }

  async delete(id) {
      await query('DELETE FROM story_series WHERE id = ?', [id]);
      return true;
  }
}
export const seriesService = new SeriesService();
