import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

import { themeService } from './theme.service.js';
class StoryVersionService {
  /**
   * Get version history for a story.
   * @param {string} id - Story ID.
   * @returns {Promise<Array>} List of story versions.
   */
  async getVersions(id) {
    const versions = await query(
      'SELECT id, story_id as storyId, title, content, age_group as ageGroup, created_at as createdAt, version, is_manually_edited as isManuallyEdited FROM story_versions WHERE story_id = ? ORDER BY version DESC',
      [id]
    );
    return await this._hydrateVersions(versions);
  }

  /**
   * Restore a previous version of a story.
   * @param {string} id - Story ID.
   * @param {string} versionId - Version ID to restore.
   * @returns {Promise<boolean>} True on success.
   * @throws {Error} If version not found.
   */
  async restoreVersion(id, versionId) {
    const connection = await getConnection();
    try {
        const versionResult = await connection.query('SELECT * FROM story_versions WHERE id = ? AND story_id = ?', [versionId, id]);
        if (versionResult[0].length === 0) throw new Error('Version not found');
        
        const versionData = versionResult[0][0];
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        await connection.beginTransaction();

        // Restore Story Main Record
        await connection.query(
          'UPDATE stories SET title = ?, content = ?, age_group = ?, modified_at = ?, version = ?, is_manually_edited = ?, audio_path = NULL WHERE id = ?',
          [versionData.title, versionData.content, versionData.age_group, now, versionData.version, versionData.is_manually_edited, id]
        );

        // Restore Themes
        await connection.query('DELETE FROM story_themes WHERE story_id = ?', [id]);
        const themeVersions = await connection.query('SELECT * FROM story_version_themes WHERE story_version_id = ?', [versionId]);
        
        for (const th of themeVersions[0]) {
            await connection.query(
                'INSERT INTO story_themes (id, story_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), id, th.theme_id, th.is_primary, now]
            );
        }

        await connection.commit();
        themeService.invalidateCache();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
  }

  /**
   * Calculate the next version number for a story.
   * Max of current version (stories table) and history (story_versions table) + 1.
   */
  async getNextVersionNumber(storyId) {
    const rows = await query(
      `SELECT 
        GREATEST(
          COALESCE((SELECT MAX(version) FROM stories WHERE id = ?), 0),
          COALESCE((SELECT MAX(version) FROM story_versions WHERE story_id = ?), 0)
        ) as max_ver`,
      [storyId, storyId]
    );
    return (rows[0]?.max_ver || 0) + 1;
  }

  /**
   * Create a new version of an existing story and its themes.
   * @param {Object} connection - Database connection with active transaction.
   * @param {Object} storyObj - The current story object to snapshot.
   * @param {Array} themes - The current themes associated with the story.
   * @returns {Promise<string>} The ID of the created version.
   */
  async createSnapshot(connection, storyObj, themes) {
    // Deduplication check: If this version already exists in history, do NOT create a duplicate snapshot.
    // This happens if we restore V1 (main becomes V1) then update (snapshot V1 created again).
    const [existing] = await connection.query(
        'SELECT id FROM story_versions WHERE story_id = ? AND version = ?', 
        [storyObj.id, storyObj.version]
    );
    
    if (existing.length > 0) {
        console.log(`[VersionService] Snapshot for story ${storyObj.id} version ${storyObj.version} already exists. Skipping creation.`);
        return existing[0].id;
    }

    const storyVersionId = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await connection.query(
      `INSERT INTO story_versions (id, story_id, title, content, age_group, created_at, version, is_manually_edited) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        storyVersionId, 
        storyObj.id, 
        storyObj.title, 
        storyObj.content, 
        storyObj.age_group, 
        storyObj.modified_at || storyObj.created_at, 
        storyObj.version, 
        storyObj.is_manually_edited
      ]
    );

    for (const th of themes) {
      await connection.query(
        'INSERT INTO story_version_themes (id, story_version_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), storyVersionId, th.theme_id, th.is_primary, now]
      );
    }

    return storyVersionId;
  }

  async _hydrateVersions(versions) {
    if (versions.length === 0) return [];
    const versionIds = versions.map(v => v.id);
    const placeholders = versionIds.map(() => '?').join(',');
    
    const themesResult = await query(
      `SELECT svt.*, t.name, t.color, svt.story_version_id 
       FROM story_version_themes svt 
       JOIN themes t ON svt.theme_id = t.id 
       WHERE svt.story_version_id IN (${placeholders})`,
      versionIds
    );

    return versions.map(v => ({
      ...v,
      themes: themesResult
        .filter(th => th.story_version_id === v.id)
        .map(th => ({
          id: th.theme_id,
          name: th.name,
          color: th.color,
          isPrimary: th.is_primary === 1
        }))
    }));
  }
}

export const storyVersionService = new StoryVersionService();
