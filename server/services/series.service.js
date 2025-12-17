import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing story series.
 */
class SeriesService {
  /**
   * Fetch all series with story count.
   * @returns {Promise<Array>} List of series with story counts.
   */
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

  /**
   * Get basic statistics and stories for a series.
   * optimized for dashboard view.
   * @param {string} id - Series ID.
   * @returns {Promise<{stories: Array}>} Object containing list of stories in series.
   */
  async getStats(id) {
    // Optimized query to fetch minimal data needed for the dashboard
    // We fetch all stories for this series to build the visualization
    // Index on series_id is crucial for performance here
    const stories = await query(`
        SELECT id, title, week_number, day_order, age_group 
        FROM stories 
        WHERE series_id = ? 
        ORDER BY week_number ASC, day_order ASC
    `, [id]);

    // Aggregate data in memory (faster than multiple complex SQL generic group bys for this specific shape)
    // Or we could do it in SQL, but fetching the list is required for the timeline view anyway.
    
    return {
        stories
    };
  }

  /**
   * Create a new series.
   * @param {Object} data - Series data.
   * @param {string} data.name - Series name.
   * @param {string} [data.description] - Series description.
   * @returns {Promise<Object>} The created series object.
   */
  async create({ name, description }) {
      const id = uuidv4();
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query('INSERT INTO story_series (id, name, description, created_at) VALUES (?, ?, ?, ?)', [id, name, description || null, now]);
      return { id, name, description, created_at: now, storyCount: 0 };
  }

  /**
   * Update an existing series.
   * @param {string} id - Series ID.
   * @param {Object} data - Updated data.
   * @param {string} data.name - Series name.
   * @param {string} [data.description] - Series description.
   * @returns {Promise<Object>} The updated series object.
   */
  async update(id, { name, description }) {
      await query('UPDATE story_series SET name = ?, description = ? WHERE id = ?', [name, description, id]);
      return { id, name, description };
  }

  /**
   * Delete a series.
   * @param {string} id - Series ID.
   * @returns {Promise<boolean>} True on success.
   */
  async delete(id) {
      await query('DELETE FROM story_series WHERE id = ?', [id]);
      return true;
  }

  /**
   * Batch add or remove stories from a series.
   * @param {string} seriesId - The target series ID.
   * @param {Object} params - Batch parameters.
   * @param {string[]} params.storyIds - Array of story IDs.
   * @param {'add'|'remove'} params.action - Action to perform.
   * @returns {Promise<{updated: number}>} Number of updated stories.
   * @throws {Error} If action is invalid.
   */
  async batchUpdateStories(seriesId, { storyIds, action }) {
      if (!storyIds || storyIds.length === 0) return { updated: 0 };
      
      const placeholders = storyIds.map(() => '?').join(',');
      const params = action === 'add' ? [seriesId, ...storyIds] : [...storyIds];
      
      let sql;
      if (action === 'add') {
          sql = `UPDATE stories SET series_id = ? WHERE id IN (${placeholders})`;
      } else if (action === 'remove') {
          sql = `UPDATE stories SET series_id = NULL WHERE id IN (${placeholders})`;
      } else {
          throw new Error('Invalid action');
      }

      const result = await query(sql, params);
      return { updated: result.affectedRows };
  }
}
export const seriesService = new SeriesService();
