import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { themeService } from './theme.service.js';
import { storyVersionService } from './story_version.service.js';
import { storyQueryHelper } from './story_query.helper.js';
import { storySeriesHelper } from './story_series.helper.js';
import { geminiService } from './gemini.service.js';
import { localLLMService } from './local_llm.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for managing stories and related data.
 * Coordinates between database and specialized helpers/services.
 */
class StoryService {
  // ... existing methods ...

  /**
   * Generate a story using AI (Gemini or Local).
   */
  async generateFromAI(params, providerOverride = null) {
      // Priority: Param > Env > Default 'gemini'
      const envProvider = process.env.AI_PROVIDER;
      const aiProvider = providerOverride || envProvider || 'gemini';
      
      console.log(`[StoryService] Generating story using provider: ${aiProvider}`);
      
      if (aiProvider === 'local') {
          return await localLLMService.generateStory(params);
      } else {
          return await geminiService.generateStory(params);
      }
  }

  /**
   * Generate audio for a story, save it, and update the record.
   */
  async generateAudioForStory(id) {
    const story = await this.findById(id);
    if (!story) throw new Error('Story not found');
    if (!story.content) throw new Error('Story content is empty');

    // Remove illustration descriptions [Illustration: ...] to avoid reading them aloud
    const contentToRead = story.content
        .replace(/\[Illustration:.*?\]/gs, '') // Remove Illustration tags
        .replace(/\*\*/g, '') // Remove bold markdown
        .replace(/\n\s*\n/g, '\n\n') // Fix spacing
        .trim();

    console.log(`[StoryService] Generating audio for story ${id}...`);
    const { audioBuffer } = await geminiService.generateAudio(contentToRead);
    
    // Ensure public/audio directory exists
    // Note: Assuming __dirname points to server/services, so ../../public/audio
    const audioDir = path.join(__dirname, '../../public/audio');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }

    const extension = 'wav';
    const fileName = `${id}_v${story.version || 1}.${extension}`;
    const filePath = path.join(audioDir, fileName);
    
    fs.writeFileSync(filePath, audioBuffer);
    const publicUrl = `/audio/${fileName}`;
    
    // Update story
    await this.saveAudioPath(id, publicUrl);
    
    return publicUrl;
  }

  /**
   * Find all stories with pagination and filtering.
   */
  async findAll(params) {
// ... rest of findAll
    const { page = 1, limit = 12 } = params;
    const offset = (page - 1) * limit;

    const { whereClause, params: queryParams } = storyQueryHelper.buildWhere(params);

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
        const stories = await query(queryStr, [...queryParams, String(limit), String(offset)]);
        return await this._hydrateStories(stories);
    })();

    const countQueryPromise = (async () => {
        const countQueryStr = `SELECT COUNT(*) as total FROM stories s WHERE ${whereClause}`;
        const result = await query(countQueryStr, queryParams);
        return result[0].total;
    })();

    const [mappedStories, total] = await Promise.all([dataQueryPromise, countQueryPromise]);
    
    return { data: mappedStories, total, page, limit };
  }

  /**
   * Get list of week numbers that have available stories.
   */
  async getAvailableWeeks(params) {
    const { whereClause, params: queryParams } = storyQueryHelper.buildWhere(params);
    const queryStr = `SELECT DISTINCT s.week_number FROM stories s WHERE ${whereClause} ORDER BY s.week_number ASC`;
    const result = await query(queryStr, queryParams);
    return result.map(row => row.week_number);
  }

  /**
   * Find multiple stories by their IDs.
   */
  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const stories = await query(
      `SELECT id, title, content, age_group as ageGroup, week_number as weekNumber, day_order as dayOrder, created_at as createdAt, modified_at as modifiedAt, version, locale 
       FROM stories 
       WHERE id IN (${placeholders})`,
      ids
    );

    return await Promise.all(stories.map(s => this.findById(s.id)));
  }

  /**
   * Find a single story by ID.
   */
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
      ...theme,
      isPrimary: theme.is_primary === 1,
      createdAt: theme.created_at
    }));

    // Illustrations
    story.illustrations = await this.getIllustrations(id);
    return story;
  }

  /**
   * Create a new story.
   */
  async create(storyData) {
    const connection = await getConnection();
    try {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const id = uuidv4();
      
      const dayOrder = storyData.day_order ?? this._mapDayToOrder(storyData.dayOfWeek) ?? 1;

      await connection.beginTransaction();

      // Resolve Series
      let seriesId = await storySeriesHelper.resolveSeriesId(connection, storyData.seriesId || storyData.series_id, storyData.seriesName || storyData.series_name);
      
      // Handle Collisions & Branching
      seriesId = await storySeriesHelper.handleCollisions(connection, {
        weekNumber: storyData.weekNumber || storyData.week_number,
        dayOrder,
        ageGroup: storyData.ageGroup || storyData.age_group,
        locale: storyData.locale,
        seriesId
      }, storyData.seriesName || storyData.series_name);

      // Insert Story
      await connection.query(
        `INSERT INTO stories (id, title, content, age_group, week_number, day_order, created_at, modified_at, version, locale, source, is_manually_edited, series_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, storyData.title, storyData.content, storyData.ageGroup || storyData.age_group, storyData.weekNumber || storyData.week_number, dayOrder, now, now, 1, storyData.locale, storyData.source || 'manual', false, seriesId]
      );

      // Link Themes
      for (const theme of (storyData.themes || [])) {
          await connection.query(
            `INSERT INTO story_themes (id, story_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), id, theme.id, theme.isPrimary, now]
          );
      }

      // Link Illustrations
      if (storyData.illustrations?.length) {
        for (const illu of storyData.illustrations) {
          await connection.query(
            `INSERT INTO illustrations (id, story_id, image_path, filename, file_type, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), id, illu.image_path || illu.imagePath || illu.path || null, illu.filename, illu.fileType || illu.file_type || null, now, illu.position || 0]
          );
        }
      }

      await connection.commit();
      themeService.invalidateCache();
      return { id, ...storyData };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update an existing story with versioning.
   */
  async update(id, storyData) {
    const connection = await getConnection();
    try {
      const [existing] = await connection.query('SELECT * FROM stories WHERE id = ?', [id]);
      if (existing.length === 0) throw new Error('Story not found');
      const oldStory = existing[0];
      
      const [oldThemes] = await connection.query('SELECT * FROM story_themes WHERE story_id = ?', [id]);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await connection.beginTransaction();

      // Delegation: Create SNAPSHOT for versioning
      await storyVersionService.createSnapshot(connection, oldStory, oldThemes);

      // Map day order
      const dayOrder = storyData.day_order ?? (storyData.dayOfWeek ? this._mapDayToOrder(storyData.dayOfWeek) : oldStory.day_order);

      // Update Main Record
      const isCurrentlyManual = oldStory.source === 'manual';
      
      // Calculate NEXT linear version (Max + 1) to avoid collision/rewind
      const nextVersion = await storyVersionService.getNextVersionNumber(id);

      await connection.query(
           `UPDATE stories SET title = ?, content = ?, age_group = ?, week_number = ?, day_order = ?, modified_at = ?, locale = ?, version = ?, is_manually_edited = ?, audio_path = NULL WHERE id = ?`,
           [storyData.title, storyData.content, storyData.ageGroup || storyData.age_group, storyData.weekNumber || storyData.week_number, dayOrder, now, storyData.locale, nextVersion, !isCurrentlyManual, id]
      );

      // Refresh Themes
      await connection.query('DELETE FROM story_themes WHERE story_id = ?', [id]);
      for (const theme of (storyData.themes || [])) {
          await connection.query(
              'INSERT INTO story_themes (id, story_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)',
              [uuidv4(), id, theme.id, theme.isPrimary, now]
          );
      }

      // Refresh Illustrations
      // Note: We assume full replacement if illustrations are provided.
      // If illustrations is undefined, we might skip, but consistent PUT usually implies replacement.
      // However, to be safe and match `create`, we check for existence.
      // If the frontend sends existing illustrations, they should be in the list.
      if (storyData.illustrations) {
          await connection.query('DELETE FROM illustrations WHERE story_id = ?', [id]);
          for (const illu of storyData.illustrations) {
              await connection.query(
                `INSERT INTO illustrations (id, story_id, image_path, filename, file_type, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), id, illu.image_path || illu.imagePath || illu.path || null, illu.filename, illu.fileType || illu.file_type || null, now, illu.position || 0]
              );
          }
      }

      await connection.commit();
      themeService.invalidateCache();
      return { id, ...storyData, modified_at: now };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete a story.
   */
  async delete(id) {
    await query('DELETE FROM stories WHERE id = ?', [id]);
    themeService.invalidateCache();
    return true;
  }

  // --- Delegation Methods ---
  
  async getVersions(id) { return storyVersionService.getVersions(id); }
  async restoreVersion(id, versionId) { return storyVersionService.restoreVersion(id, versionId); }
  
  // --- Legacy/Small Helpers ---

  async getIllustrations(storyId) {
      return await query(
          'SELECT id, story_id as storyId, image_path, filename, file_type as fileType, position, created_at as createdAt FROM illustrations WHERE story_id = ? ORDER BY position ASC',
          [storyId]
      );
  }

  async deleteIllustration(storyId, illustrationId) {
       const rows = await query('SELECT image_path FROM illustrations WHERE id = ? AND story_id = ?', [illustrationId, storyId]);
       if (rows.length === 0) return null;
       await query('DELETE FROM illustrations WHERE id = ? AND story_id = ?', [illustrationId, storyId]);
       themeService.invalidateCache();
       return rows[0].image_path;
  }

  async saveAudioPath(storyId, audioPath) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query('UPDATE stories SET audio_path = ?, modified_at = ? WHERE id = ?', [audioPath, now, storyId]);
      themeService.invalidateCache();
  }

  async getNeighbors(id) {
     const story = await query(`SELECT week_number, day_order, age_group, series_id FROM stories WHERE id = ?`, [id]);
     if (story.length === 0) return { next: null, prev: null };
     const { week_number, day_order, age_group, series_id } = story[0];

     let nextR, prevR;
     if (series_id) {
         nextR = await query(`SELECT id, title FROM stories WHERE week_number = ? AND day_order > ? AND age_group = ? AND series_id = ? ORDER BY day_order ASC LIMIT 1`, [week_number, day_order, age_group, series_id]);
         prevR = await query(`SELECT id, title FROM stories WHERE week_number = ? AND day_order < ? AND age_group = ? AND series_id = ? ORDER BY day_order DESC LIMIT 1`, [week_number, day_order, age_group, series_id]);
     } else {
         nextR = await query(`SELECT id, title FROM stories WHERE week_number = ? AND day_order > ? AND age_group = ? AND series_id IS NULL ORDER BY day_order ASC LIMIT 1`, [week_number, day_order, age_group]);
         prevR = await query(`SELECT id, title FROM stories WHERE week_number = ? AND day_order < ? AND age_group = ? AND series_id IS NULL ORDER BY day_order DESC LIMIT 1`, [week_number, day_order, age_group]);
     }
     return { next: nextR[0] || null, prev: prevR[0] || null };
  }

  async getNext(id) { return (await this.getNeighbors(id)).next; }
  async getPrevious(id) { return (await this.getNeighbors(id)).prev; }

  // --- Private Helpers ---

  async _hydrateStories(stories) {
    if (stories.length === 0) return [];
    
    // N+1 Optimization for illustrations
    const storyIds = stories.map(s => s.id);
    const placeholders = storyIds.map(() => '?').join(',');
    const allIllu = await query(
        `SELECT id, story_id, image_path, filename, file_type, position FROM illustrations WHERE story_id IN (${placeholders}) ORDER BY story_id, position ASC`,
        storyIds
    );

    return stories.map((story) => {
        const themes = story.theme_ids?.split(',').map((id, index) => ({
            id,
            name: story.theme_names?.split(',')[index],
            isPrimary: story.theme_primaries?.split(',')[index] === '1'
        })) || [];
          
        delete story.theme_names; delete story.theme_descriptions; delete story.theme_ids; delete story.theme_primaries;
        const illustrations = allIllu.filter(img => img.story_id === story.id);
        return { ...story, themes, illustrations };
    });
  }

  _mapDayToOrder(day) {
    return { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 }[day] || null;
  }
}

export const storyService = new StoryService();
