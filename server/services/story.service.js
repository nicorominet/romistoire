import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { themeService } from './theme.service.js';

class StoryService {
  async findAll({ page = 1, limit = 12, locale = 'fr', theme, ageGroup, weekNumber, dayOfWeek, search, hasImage, seriesId }) {
    const offset = (page - 1) * limit;

    // Helper to build WHERE clause and params
    const buildWhere = () => {
        let whereClauses = ['s.locale = ?'];
        let params = [locale];

        if (seriesId && seriesId !== 'all') {
            whereClauses.push('s.series_id = ?');
            params.push(seriesId);
        }

        if (theme && theme !== 'all') {
            whereClauses.push('EXISTS (SELECT 1 FROM story_themes WHERE story_id = s.id AND theme_id = ?)');
            params.push(theme);
        }

        if (ageGroup && ageGroup !== 'all') {
            whereClauses.push('s.age_group = ?');
            params.push(ageGroup);
        }

        if (weekNumber) {
            whereClauses.push('s.week_number = ?');
            params.push(weekNumber);
        }

        if (dayOfWeek && dayOfWeek !== 'all') {
            whereClauses.push('s.day_order = ?');
            params.push(parseInt(dayOfWeek, 10));
        }

        if (search) {
            whereClauses.push('(s.title LIKE ? OR s.content LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (hasImage && hasImage !== 'all') {
            if (hasImage === 'yes') {
                whereClauses.push('EXISTS (SELECT 1 FROM illustrations WHERE story_id = s.id)');
            } else if (hasImage === 'no') {
                whereClauses.push('NOT EXISTS (SELECT 1 FROM illustrations WHERE story_id = s.id)');
            }
        }
        
        return { whereClause: whereClauses.join(' AND '), params };
    };

    const { whereClause, params } = buildWhere();

    const dataQueryPromise = (async () => {
        const queryStr = `
            SELECT s.*, ss.name as series_name, GROUP_CONCAT(t.name) as theme_names,
                   GROUP_CONCAT(t.description) as theme_descriptions,
                   GROUP_CONCAT(t.id) as theme_ids,
                   GROUP_CONCAT(st.is_primary) as theme_primaries
            FROM stories s
            LEFT JOIN story_themes st ON s.id = st.story_id
            LEFT JOIN themes t ON st.theme_id = t.id
            LEFT JOIN story_series ss ON s.series_id = ss.id
            WHERE ${whereClause}
            GROUP BY s.id ORDER BY s.day_order ASC, s.created_at ASC LIMIT ? OFFSET ?
        `;
        const stories = await query(queryStr, [...params, String(limit), String(offset)]);
        
        // Optimize N+1 illustration queries
        const storyIds = stories.map(s => s.id);
        let allIllustrations = [];
        if (storyIds.length > 0) {
            const placeholders = storyIds.map(() => '?').join(',');
            allIllustrations = await query(
                `SELECT id, story_id, image_path, filename, file_type, position 
                 FROM illustrations 
                 WHERE story_id IN (${placeholders}) 
                 ORDER BY story_id, position ASC`,
                storyIds
            );
        }

        // Map content
        return stories.map((story) => {
            const themes = story.theme_ids?.split(',').map((id, index) => ({
                id,
                name: story.theme_names?.split(',')[index],
                description: story.theme_descriptions?.split(',')[index],
                isPrimary: story.theme_primaries?.split(',')[index] === '1'
            })) || [];
              
            delete story.theme_names;
            delete story.theme_descriptions;
            delete story.theme_ids;
            delete story.theme_primaries;

            const illustrations = allIllustrations.filter(img => img.story_id === story.id);
            return { ...story, themes, illustrations };
        });
    })();

    const countQueryPromise = (async () => {
        const countQueryStr = `SELECT COUNT(*) as total FROM stories s WHERE ${whereClause}`;
        const result = await query(countQueryStr, params);
        return result[0].total;
    })();

    const [mappedStories, total] = await Promise.all([dataQueryPromise, countQueryPromise]);
    
    return {
      data: mappedStories,
      total,
      page,
      limit
    };
  }

  async getAvailableWeeks({ locale = 'fr', theme, ageGroup, seriesId }) {
    let queryStr = `SELECT DISTINCT week_number FROM stories WHERE locale = ?`;
    const params = [locale];

    if (seriesId && seriesId !== 'all') {
      queryStr += ' AND series_id = ?';
      params.push(seriesId);
    }

    if (theme && theme !== 'all') {
      queryStr += ' AND EXISTS (SELECT 1 FROM story_themes WHERE story_id = stories.id AND theme_id = ?)';
      params.push(theme);
    }

    if (ageGroup && ageGroup !== 'all') {
      queryStr += ' AND age_group = ?';
      params.push(ageGroup);
    }
    
    queryStr += ' ORDER BY week_number ASC';

    const result = await query(queryStr, params);
    return result.map(row => row.week_number);
  }

  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    
    // Create placeholders for IN clause
    const placeholders = ids.map(() => '?').join(',');
    const stories = await query(
      `SELECT id, title, content, age_group as ageGroup, week_number as weekNumber, day_order as dayOrder, created_at as createdAt, modified_at as modifiedAt, version, locale 
       FROM stories 
       WHERE id IN (${placeholders})`,
      ids
    );

    // Enrich stories with themes and illustrations
    // We optimization here as well could be done but usually findByIds is for small sets
    return await Promise.all(stories.map(async (story) => {
      // Themes
      const themes = await query(`
        SELECT t.id, t.name, t.description, t.color, st.is_primary as isPrimary
        FROM story_themes st
        JOIN themes t ON st.theme_id = t.id
        WHERE st.story_id = ?
      `, [story.id]);

      // Illustrations (using getIllustrations helper)
      const illustrations = await this.getIllustrations(story.id);

      return {
        ...story,
        themes: themes.map(t => ({ ...t, isPrimary: t.isPrimary === 1 })),
        illustrations
      };
    }));
  }

  async getIllustrations(storyId) {
      return await query(
          'SELECT id, story_id as storyId, image_path, filename, file_type as fileType, position, created_at as createdAt FROM illustrations WHERE story_id = ? ORDER BY position ASC',
          [storyId]
      );
  }

  async findById(id) {
    const storyResult = await query(`
      SELECT s.*, ss.name as series_name
      FROM stories s
      LEFT JOIN story_series ss ON s.series_id = ss.id
      WHERE s.id = ?
    `, [id]);
  
    if (storyResult.length === 0) return null;
  
    const story = storyResult[0];
  
    // Themes
    const themesResult = await query(`
      SELECT t.*, st.is_primary
      FROM themes t
      INNER JOIN story_themes st ON t.id = st.theme_id
      WHERE st.story_id = ?
    `, [id]);
  
    story.themes = themesResult.map(theme => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      isPrimary: theme.is_primary === 1,
      color: theme.color,
      createdAt: theme.created_at
    }));

    // Illustrations
    story.illustrations = await query(
        'SELECT id, story_id as storyId, image_path, filename, file_type as fileType, position, created_at as createdAt FROM illustrations WHERE story_id = ? ORDER BY position ASC',
        [id]
    );
  
    return story;
  }

  async getNeighbors(id) {
     const story = await query(`SELECT week_number, day_order, age_group, series_id, created_at FROM stories WHERE id = ?`, [id]);
     if (story.length === 0) return { next: null, prev: null };
     const { week_number, day_order, age_group, series_id, created_at } = story[0];

     const nextResult = await query(
         `SELECT id, title FROM stories WHERE week_number = ? AND day_order > ? AND age_group = ? ORDER BY day_order ASC LIMIT 1`,
         [week_number, day_order, age_group]
     );

     const prevResult = await query(
         `SELECT id, title FROM stories WHERE week_number = ? AND day_order < ? AND age_group = ? ORDER BY day_order DESC LIMIT 1`,
         [week_number, day_order, age_group]
     );
     
     return {
        next: nextResult[0] || null,
        prev: prevResult[0] || null
     };
  }

  async getNext(id) {
     const neighbors = await this.getNeighbors(id);
     return neighbors.next;
  }

  async getPrevious(id) {
     const neighbors = await this.getNeighbors(id);
     return neighbors.prev;
  }

  async getVersions(id) {
      return await query(
        'SELECT id, story_id as storyId, title, content, age_group as ageGroup, created_at as createdAt, version FROM story_versions WHERE story_id = ? ORDER BY version DESC',
        [id]
      );
  }

  async create(storyData) {
    const connection = await getConnection();
    try {
      const { title, content, themes, ageGroup, locale, dayOfWeek, weekNumber, illustrations, seriesId, seriesName } = storyData;
      
      const id = uuidv4();
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const version = 1;
      const dayOrder = {
        'Sunday': 7, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
      }[dayOfWeek] || (dayOfWeek === 'Monday' ? 1 : 0); // Fallback

      await connection.beginTransaction();

      let finalSeriesId = seriesId;
      if (!finalSeriesId && seriesName) {
         const [existingSeries] = await connection.query('SELECT id FROM story_series WHERE name = ?', [seriesName]);
         if (existingSeries.length > 0) {
             finalSeriesId = existingSeries[0].id;
         } else {
             finalSeriesId = uuidv4();
             const seriesNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
             await connection.query(
                 'INSERT INTO story_series (id, name, created_at) VALUES (?, ?, ?)',
                 [finalSeriesId, seriesName, seriesNow]
             );
         }
      }

      await connection.query(
        `INSERT INTO stories
         (id, title, content, age_group, week_number, day_order, created_at, modified_at, version, locale, series_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, content, ageGroup, weekNumber, dayOrder, now, now, version, locale, finalSeriesId || null]
      );

      for (const theme of themes) {
          await connection.query(
            `INSERT INTO story_themes (id, story_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), id, theme.id, theme.isPrimary, now]
          );
      }

      if (illustrations?.length) {
        for (const illustration of illustrations) {
          await connection.query(
            `INSERT INTO illustrations (id, story_id, image_path, filename, file_type, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), id, illustration.image_path || illustration.imagePath || illustration.path || null, illustration.filename, illustration.fileType || illustration.file_type || null, now, illustration.position || 0]
          );
        }
      }

      await connection.commit();
      return { id, ...storyData }; // Return basic info or fetch full story
    } catch (error) {
      await connection.rollback();
      throw error;
      } finally {
      connection.release();
    }
      themeService.invalidateCache();
  }

  async restoreVersion(id, versionId) {
      const versionResult = await query('SELECT * FROM story_versions WHERE id = ? AND story_id = ?', [versionId, id]);
      if (versionResult.length === 0) throw new Error('Version not found');
      
      const versionData = versionResult[0];
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      await query(
        'UPDATE stories SET title = ?, content = ?, theme_id = ?, age_group = ?, modified_at = ?, version = ? WHERE id = ?',
        [versionData.title, versionData.content, versionData.theme_id, versionData.age_group, now, versionData.version, id]
      );
      return true;
  }
  
  async update(id, storyData) {
      const connection = await getConnection();
      try {
        const { title, content, themes, ageGroup, locale, dayOfWeek, weekNumber, version } = storyData;
        
        // 1. Fetch existing story
        const [existingStoryRows] = await connection.query('SELECT * FROM stories WHERE id = ?', [id]);
        if (existingStoryRows.length === 0) throw new Error('Story not found');
        const existingStoryObj = existingStoryRows[0];
        
        // Fetch themes for versioning
        const [existingThemes] = await connection.query('SELECT * FROM story_themes WHERE story_id = ?', [id]);

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const dayOrder = { 'Sunday': 7, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 }[dayOfWeek] || 0;
        
        await connection.beginTransaction();

        // Save version
        const storyVersionId = uuidv4();
        await connection.query(
          `INSERT INTO story_versions (id, story_id, title, content, age_group, created_at, version) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [storyVersionId, id, existingStoryObj.title, existingStoryObj.content, existingStoryObj.age_group, existingStoryObj.modified_at, existingStoryObj.version]
        );

        for (const th of existingThemes) {
             await connection.query(
                 'INSERT INTO story_version_themes (id, story_version_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)',
                 [uuidv4(), storyVersionId, th.theme_id, th.is_primary, now]
             );
        }

        // Update Story
        await connection.query(
             `UPDATE stories SET title = ?, content = ?, age_group = ?, week_number = ?, day_order = ?, modified_at = ?, locale = ?, version = ? WHERE id = ?`,
             [title, content, ageGroup, weekNumber, dayOrder, now, locale, version, id]
        );

        // Update Themes
        await connection.query('DELETE FROM story_themes WHERE story_id = ?', [id]);
        if (themes && themes.length > 0) {
            for (const theme of themes) {
                await connection.query(
                    'INSERT INTO story_themes (id, story_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)',
                    [uuidv4(), id, theme.id, theme.isPrimary, now]
                );
            }
        }

        await connection.commit();
        return { id, ...storyData, modified_at: now };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      themeService.invalidateCache();
  }

  async delete(id) {
    // Check if exists?
    // Delete logic (Cascading usually handles some, but let's be safe if manual delete needed)
    // Using simple delete query assuming FK constraints on DELETE CASCADE or SET NULL
    await query('DELETE FROM stories WHERE id = ?', [id]);
    themeService.invalidateCache();
    return true;
  }

  async deleteIllustration(storyId, illustrationId) {
      // Find valid file path first to return it? Or separate job?
      // deleteRoutes cleaned up file.
      // We should return the path so controller/service can cleanup.
       const rows = await query('SELECT image_path FROM illustrations WHERE id = ? AND story_id = ?', [illustrationId, storyId]);
       if (rows.length === 0) return null;
       
       await query('DELETE FROM illustrations WHERE id = ? AND story_id = ?', [illustrationId, storyId]);
       return rows[0].image_path;
  }
}

export const storyService = new StoryService();
