import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { ENV_CONFIG } from '../config/env.config.js';

/**
 * Service for system-level operations like data import/export, file management, and logs.
 */
class SystemService {
  /**
   * Import data from a JSON or ZIP file.
   * @param {Object} file - The uploaded file object from multer.
   * @param {'skip'|'overwrite'} [mode='skip'] - Import mode.
   * @returns {Promise<{success: boolean}>} Result of import.
   * @throws {Error} If file format is invalid or import fails.
   */
  async importData(file, mode = 'skip') {
      const { filename, path: filePath, mimetype } = file;
      const isZip = mimetype === 'application/zip' || filename.endsWith('.zip');
      
      let dataToImport = null;
      let imagesDir = null;
      let tempDir = null;

      try {
          if (isZip) {
              const zip = new AdmZip(filePath);
              tempDir = path.join(process.cwd(), 'temp_import_' + Date.now());
              zip.extractAllTo(tempDir, true);

              const dataPath = path.join(tempDir, 'data.json');
              if (fs.existsSync(dataPath)) {
                  dataToImport = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
              } else {
                  throw new Error('Invalid ZIP archive: data.json not found.');
              }

              const extractedImagesDir = path.join(tempDir, 'images');
              if (fs.existsSync(extractedImagesDir)) {
                  imagesDir = extractedImagesDir;
              }
          } else {
              dataToImport = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          }
      } finally {
          try { fs.unlinkSync(filePath); } catch(e) {}
      }

      if (!dataToImport) throw new Error('No data found to import.');

      const { stories, versions, illustrations, weeklyThemes, themes, storyThemes, storySeries } = dataToImport;

      const insertData = async (tableName, data) => {
        if (!data || data.length === 0) return;

        let validColumns = [];
        try {
          const columnsResult = await query(`SHOW COLUMNS FROM ${tableName}`);
          validColumns = columnsResult.map(row => row.Field);
        } catch (err) { return; }
        
        for (const item of data) {
          try {
            const columns = Object.keys(item).filter(key => validColumns.includes(key));
            const values = columns.map(column => {
              let value = item[column];
              if (typeof value === 'string' && (column === 'created_at' || column === 'modified_at')) {
                const parsedDate = new Date(value);
                if (!isNaN(parsedDate.getTime())) {
                  value = parsedDate.toISOString().slice(0, 19).replace('T', ' ');
                }
              } else if (value instanceof Date) {
                value = value.toISOString().slice(0, 19).replace('T', ' ');
              }
              return value;
            });

            const idColumn = columns.find(col => col === 'id');
            const pkColumn = tableName === 'weekly_themes' ? 'week_number' : (idColumn || 'id');
            
            if (!columns.includes(pkColumn)) continue;

            const pkValue = item[pkColumn];
            const existing = await query(`SELECT 1 FROM ${tableName} WHERE ${pkColumn} = ?`, [pkValue]);

            if (existing && existing.length > 0) {
              if (mode === 'overwrite') {
                  await query(`DELETE FROM ${tableName} WHERE ${pkColumn} = ?`, [pkValue]);
              } else {
                  continue;
              }
            }

            const placeholders = columns.map(() => '?').join(', ');
            await query(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
          } catch (error) {
            console.error(`Error inserting/updating ${tableName}:`, error);
          }
        }
      };

      try {
        await query('SET FOREIGN_KEY_CHECKS = 0');
        await insertData('story_series', storySeries);
        await insertData('themes', themes);
        await insertData('weekly_themes', weeklyThemes);
        await insertData('stories', stories);
        await insertData('story_themes', storyThemes);
        await insertData('story_versions', versions);
        await insertData('illustrations', illustrations);
        await query('SET FOREIGN_KEY_CHECKS = 1');

        if (imagesDir && fs.existsSync(imagesDir)) {
            const targetUploads = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(targetUploads)) fs.mkdirSync(targetUploads, { recursive: true });

            const copyImages = (src, dest) => {
                const entries = fs.readdirSync(src, { withFileTypes: true });
                for (const entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath);
                        copyImages(srcPath, destPath);
                    } else {
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            };
            copyImages(imagesDir, targetUploads);
        }
      } catch (error) {
         try { await query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) {}
         throw error;
      } finally {
         if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
         }
      }
      return { success: true };
  }

  /**
   * Export all data.
   * @param {boolean} [full=false] - If true, exports ZIP with images; otherwise JSON only.
   * @returns {Promise<{buffer: Buffer, filename: string, type: string}>} Export file data.
   */
  async exportData(full = false) {
    const stories = await query('SELECT * FROM stories');
    const versions = await query('SELECT * FROM story_versions');
    const illustrations = await query('SELECT * FROM illustrations');
    const weeklyThemes = await query('SELECT * FROM weekly_themes');
    const themes = await query('SELECT * FROM themes');
    const storyThemes = await query('SELECT * FROM story_themes');
    const storySeries = await query('SELECT * FROM story_series');

    const exportData = {
      stories,
      versions,
      illustrations,
      weeklyThemes,
      themes,
      storyThemes,
      storySeries,
      exportDate: new Date().toISOString()
    };

    if (full) {
        const zip = new AdmZip();
        // Add data.json
        zip.addFile("data.json", Buffer.from(JSON.stringify(exportData, null, 2)));
        
        // Add images
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (fs.existsSync(uploadsDir)) {
           zip.addLocalFolder(uploadsDir, "images");
        }
        return { buffer: zip.toBuffer(), filename: `romihistoire-full-export-${new Date().toISOString().slice(0, 10)}.zip`, type: 'application/zip' };
    } else {
        return { buffer: Buffer.from(JSON.stringify(exportData, null, 2)), filename: `romihistoire-data-export-${new Date().toISOString().slice(0, 10)}.json`, type: 'application/json' };
    }
  }

  /**
   * Scan for and remove unused illustration files.
   * @returns {Promise<{deletedCount: number, reclaimedSpace: number}>} Cleanup stats.
   */
  async cleanupImages() {
    const illustrations = await query('SELECT image_path FROM illustrations');
    const usedPaths = new Set(illustrations.map(i => i.image_path).filter(p => p).map(p => path.normalize(p)));
    const uploadsDir = path.join(process.cwd(), 'uploads');
    let deletedCount = 0;
    let reclaimedSpace = 0;

    if (!fs.existsSync(uploadsDir)) return { deletedCount: 0, reclaimedSpace: 0 };

    function walkDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath);
          if (fs.readdirSync(filePath).length === 0) fs.rmdirSync(filePath);
        } else {
            const relativePath = path.relative(process.cwd(), filePath);
            const normalizedRelative = path.normalize(relativePath);
            if (!usedPaths.has(normalizedRelative)) {
                try {
                    const size = stat.size;
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    reclaimedSpace += size;
                } catch (err) {}
            }
        }
      }
    }
    walkDir(uploadsDir);
    return { deletedCount, reclaimedSpace };
  }

  /**
   * Reset all application data (stories, themes, etc.).
   * @returns {Promise<void>}
   */
  async resetData() {
      const connection = await getConnection();
      try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM illustrations');
        await connection.query('DELETE FROM story_version_themes');
        await connection.query('DELETE FROM story_versions');
        await connection.query('DELETE FROM story_themes');
        await connection.query('DELETE FROM stories');
        await connection.query('DELETE FROM themes');
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
  }

  /**
   * Process an uploaded image file.
   * @param {Object} file - Uploaded file object.
   * @param {Object} params - Additional parameters.
   * @param {string} [params.storyId] - Associate image with story.
   * @param {number} [params.position=0] - Position in story.
   * @returns {Promise<{filename: string, imagePath: string}>} File info.
   */
  async uploadImage(file, { storyId, position = 0 }) {
      const { filename, path: filePath, mimetype } = file;
      // path relative to root
      const uploadsIndex = filePath.lastIndexOf('uploads');
      const relativePath = uploadsIndex !== -1 ? filePath.substring(uploadsIndex) : filename;
      
      if (storyId && storyId !== 'null' && storyId !== 'undefined') {
        const id = uuidv4();
        await query(
          'INSERT INTO illustrations (id, story_id, filename, file_type, image_path, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, storyId, filename, mimetype, relativePath, new Date().toISOString().slice(0,19).replace('T',' '), position]
        );
      }
      
      return { filename, imagePath: relativePath };
  }

  /**
   * List available log files.
   * @returns {Promise<Array<{filename: string, date: string, size: number}>>} List of logs.
   */
  async getLogsList() {
      const logsDir = path.join(ENV_CONFIG.PROJECT_ROOT, 'server', 'logs');
      if (!fs.existsSync(logsDir)) return [];
      
      const files = await fs.promises.readdir(logsDir);
      return files
          .filter(f => f.startsWith('access-') && f.endsWith('.log'))
          .map(f => ({
              filename: f,
              date: f.replace('access-', '').replace('.log', ''),
              size: fs.statSync(path.join(logsDir, f)).size
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Get content of a specific log file.
   * @param {string} filename - Log filename.
   * @returns {Promise<Array<Object>>} Parsed log entries.
   * @throws {Error} If file not found.
   */
  async getLogContent(filename) {
      const logsDir = path.join(ENV_CONFIG.PROJECT_ROOT, 'server', 'logs');
      // Security check: prevent directory traversal
      const safeFilename = path.basename(filename); 
      const filePath = path.join(logsDir, safeFilename);

      if (!fs.existsSync(filePath)) {
          throw new Error('Log file not found');
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      // Parse NDJSON (Newlines Delimited JSON)
      const lines = content.trim().split('\n');
      return lines.map(line => {
          try { return JSON.parse(line); } catch (e) { return null; }
      }).filter(Boolean).reverse(); // Newest first
  }
}

export const systemService = new SystemService();
