import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { once } from 'events';
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { ENV_CONFIG } from '../config/env.config.js';
import { IMAGE_EXTENSIONS } from '../config/upload.config.js';
import { normalizeThemeName } from '../../shared/themeName.js';
import { themeService } from './theme.service.js';
import { ValidationError } from '../middleware/error.middleware.js';

// Files an imported archive may drop into uploads/: images and generated audio only (never .html, .js...)
const IMPORTABLE_MEDIA_EXTENSIONS = new Set([...Object.values(IMAGE_EXTENSIONS), '.jpeg', '.wav', '.mp3', '.ogg', '.webm']);
import { logger } from '../config/logger.js';

/**
 * Tables of an export / backup, in an order that keeps the foreign keys valid on import.
 * key: property of data.json. primaryKey: columns identifying a row (an existing row is skipped or overwritten).
 * Every table of the schema must be listed here or in NOT_EXPORTED_TABLES (checked by a test).
 */
export const EXPORTED_TABLES = [
  { key: 'storySeries', table: 'story_series' },
  { key: 'themes', table: 'themes' },
  { key: 'weeklyThemes', table: 'weekly_themes', primaryKey: ['week_number'] },
  { key: 'stories', table: 'stories' },
  { key: 'storyThemes', table: 'story_themes' },
  { key: 'versions', table: 'story_versions' },
  { key: 'versionThemes', table: 'story_version_themes' },
  { key: 'illustrations', table: 'illustrations' },
  { key: 'generationJobs', table: 'generation_jobs' },
  { key: 'generationUnits', table: 'generation_units' },
  // Bible of the framed series and what its weeks established
  { key: 'seriesCasts', table: 'series_casts' },
  { key: 'seriesFacts', table: 'series_facts' },
  { key: 'seriesWeekRecaps', table: 'series_week_recaps', primaryKey: ['cast_id', 'age_group', 'week_number'] }
];

// Limits of an imported ZIP, checked before extraction (zip bomb): a full backup holds the images and audio
// of the library, already compressed (a ratio close to 1)
export const ZIP_LIMITS = { maxEntries: 50000, maxUncompressedBytes: 4 * 1024 ** 3 };

/**
 * Refuses an archive too large once extracted, or holding a path outside the extraction folder.
 * @param {AdmZip} zip
 * @param {string} targetDir - Extraction folder.
 * @throws {ValidationError}
 */
export const checkZipArchive = (zip, targetDir, limits = ZIP_LIMITS) => {
  const entries = zip.getEntries();
  if (entries.length > limits.maxEntries) throw new ValidationError(`Archive refused: more than ${limits.maxEntries} files`);
  let total = 0;
  for (const entry of entries) {
    total += Number(entry.header?.size) || 0;
    const target = path.resolve(targetDir, entry.entryName);
    if (target !== targetDir && !target.startsWith(targetDir + path.sep)) {
      throw new ValidationError(`Archive refused: invalid path ${entry.entryName}`);
    }
  }
  if (total > limits.maxUncompressedBytes) throw new ValidationError('Archive refused: too large once extracted');
};

/**
 * Quota statistics: they describe the requests really sent from this installation.
 * Read by the export coverage test.
 * @internal
 */
export const NOT_EXPORTED_TABLES = ['ai_requests'];

/** "2026-10-09T12:47:05.000Z" (dates of data.json) -> "2026-10-09 12:47:05" (UTC, as the app writes them). */
const toSqlDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

/**
 * Value of data.json -> value for an INSERT: dates of the *_at columns in SQL form,
 * JSON columns (read back by mysql2 as objects / arrays) as JSON text.
 */
export const toImportValue = (column, value) => {
  if (value instanceof Date) return toSqlDateTime(value);
  if (typeof value === 'string' && (column === 'at' || column.endsWith('_at'))) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : toSqlDateTime(date);
  }
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
};

/**
 * Converts an absolute file path to the path stored in DB: relative to the project root, with "/" separators.
 * @param {string} absolutePath - Absolute path of a file inside the project.
 * @returns {string} e.g. "uploads/2026-10/file.png".
 */
export const toStoredPath = (absolutePath) =>
  path.relative(ENV_CONFIG.PROJECT_ROOT, absolutePath).split(path.sep).join('/');

/**
 * Every file of a directory, recursively, sorted (missing directory: none).
 * @param {string} dir
 * @returns {Promise<string[]>} Absolute paths.
 */
export const listFiles = async (dir) => {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
};

/**
 * Number of files and total size of a directory, recursively (missing directory: zeros).
 * Asynchronous: a large uploads folder never blocks the server.
 * @param {string} dir
 * @returns {Promise<{files: number, bytes: number}>}
 */
export const dirUsage = async (dir) => {
  const usage = { files: 0, bytes: 0 };
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return usage;
    throw error;
  }
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await dirUsage(entryPath);
      usage.files += sub.files;
      usage.bytes += sub.bytes;
    } else if (entry.isFile()) {
      usage.files++;
      usage.bytes += (await fs.promises.stat(entryPath)).size;
    }
  }
  return usage;
};

/**
 * Service for system-level operations like data import/export, file management, and logs.
 */
class SystemService {
  /**
   * Import data from a JSON or ZIP file.
   * @param {Object} file - The uploaded file object from multer.
   * @param {'skip'|'overwrite'} [mode='skip'] - Import mode.
   * @param {{keepSource?: boolean}} [options] - keepSource: the file is a backup of the server, not an upload
   *   (an upload is deleted once read).
   * @returns {Promise<{success: boolean, inserted: number, skipped: number, failed: number}>} Result of import (row counts).
   * @throws {Error} If file format is invalid or import fails.
   */
  async importData(file, mode = 'skip', { keepSource = false } = {}) {
      const { filename, path: filePath, mimetype } = file;
      const isZip = mimetype === 'application/zip' || filename.endsWith('.zip');
      
      let dataToImport = null;
      let imagesDir = null;
      let tempDir = null;

      try {
          if (isZip) {
              const zip = new AdmZip(filePath);
              // System temp folder: never inside the project (served or scanned folders)
              const extractDir = path.join(os.tmpdir(), `romistoire-import-${Date.now()}`);
              checkZipArchive(zip, extractDir);
              tempDir = extractDir;
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
          if (!keepSource) {
              try { fs.unlinkSync(filePath); } catch(e) {}
          }
      }

      if (!dataToImport) throw new Error('No data found to import.');

      const { themes: rawThemes, storyThemes: rawStoryThemes, versionThemes: rawVersionThemes } = dataToImport;

      // Themes are unique by normalized name: an imported "Nature" reuses the local "nature",
      // and the story / week links of the imported id are moved to the local theme.
      const themeIdMap = new Map();
      const themes = [];
      const seenNames = new Map();
      for (const theme of rawThemes || []) {
        const normalized = normalizeThemeName(theme.name);
        if (!normalized) continue;
        if (seenNames.has(normalized)) { themeIdMap.set(theme.id, seenNames.get(normalized)); continue; }
        const [local] = await query('SELECT id FROM themes WHERE normalized_name = ?', [normalized]);
        if (local && local.id !== theme.id) {
          themeIdMap.set(theme.id, local.id);
          seenNames.set(normalized, local.id);
          continue;
        }
        seenNames.set(normalized, theme.id);
        themes.push({ ...theme, normalized_name: normalized });
      }
      const mapThemeId = (row) => (row.theme_id && themeIdMap.has(row.theme_id) ? { ...row, theme_id: themeIdMap.get(row.theme_id) } : row);
      const storyThemes = (rawStoryThemes || []).map(mapThemeId);
      const versionThemes = (rawVersionThemes || []).map(mapThemeId);
      // Rows to insert per table. Week topics are free text: unknown columns (theme_id from older exports)
      // are ignored by insertData, like every column the local schema does not have.
      const rowsOf = { ...dataToImport, themes, storyThemes, versionThemes };

      // FOREIGN_KEY_CHECKS is a session variable: every statement must run on the same connection
      const connection = await getConnection();
      const run = async (sql, params = []) => {
        const [rows] = await connection.query(sql, params);
        return rows;
      };
      const stats = { inserted: 0, skipped: 0, failed: 0 };

      const insertData = async ({ table: tableName, primaryKey = ['id'] }, data) => {
        if (!Array.isArray(data) || data.length === 0) return;

        let validColumns = [];
        try {
          const columnsResult = await run(`SHOW COLUMNS FROM ${tableName}`);
          validColumns = columnsResult.map(row => row.Field);
        } catch (err) { return; }

        for (const item of data) {
          try {
            const columns = Object.keys(item).filter(key => validColumns.includes(key));
            if (!primaryKey.every(column => columns.includes(column))) continue;
            const values = columns.map(column => toImportValue(column, item[column]));

            const where = primaryKey.map(column => `${column} = ?`).join(' AND ');
            const keyValues = primaryKey.map(column => item[column]);
            const existing = await run(`SELECT 1 FROM ${tableName} WHERE ${where}`, keyValues);

            if (existing && existing.length > 0) {
              if (mode === 'overwrite') {
                  await run(`DELETE FROM ${tableName} WHERE ${where}`, keyValues);
              } else {
                  stats.skipped++;
                  continue;
              }
            }

            const placeholders = columns.map(() => '?').join(', ');
            await run(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
            stats.inserted++;
          } catch (error) {
            stats.failed++;
            console.error(`Error inserting/updating ${tableName}:`, error);
          }
        }
      };

      try {
        try {
          await run('SET FOREIGN_KEY_CHECKS = 0');
          for (const table of EXPORTED_TABLES) {
            await insertData(table, rowsOf[table.key]);
          }
        } finally {
          try { await run('SET FOREIGN_KEY_CHECKS = 1'); } finally { connection.release(); }
        }
        themeService.invalidateCache();

        if (imagesDir && fs.existsSync(imagesDir)) {
            const targetUploads = ENV_CONFIG.UPLOADS_DIR;
            if (!fs.existsSync(targetUploads)) fs.mkdirSync(targetUploads, { recursive: true });

            const copyImages = async (src, dest) => {
                const entries = await fs.promises.readdir(src, { withFileTypes: true });
                for (const entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        await fs.promises.mkdir(destPath, { recursive: true });
                        await copyImages(srcPath, destPath);
                    } else if (IMPORTABLE_MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                        await fs.promises.copyFile(srcPath, destPath);
                    } else {
                        console.warn(`[Import] Skipped non-media file from archive: ${entry.name}`);
                    }
                }
            };
            await copyImages(imagesDir, targetUploads);
        }
      } finally {
         if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
         }
      }
      return { success: true, ...stats };
  }

  /** Rows of every exported table, as written in data.json. */
  async collectExportData() {
    const exportData = {};
    for (const { key, table } of EXPORTED_TABLES) {
      exportData[key] = await query(`SELECT * FROM ${table}`);
    }
    exportData.exportDate = new Date().toISOString();
    return exportData;
  }

  /**
   * Data export (JSON, without the files).
   * @returns {Promise<{buffer: Buffer, filename: string, type: string}>}
   */
  async exportData() {
    const exportData = await this.collectExportData();
    return {
      buffer: Buffer.from(JSON.stringify(exportData, null, 2)),
      filename: `imagitales-data-export-${new Date().toISOString().slice(0, 10)}.json`,
      type: 'application/json'
    };
  }

  /**
   * Full export (data.json + every file of uploads/ under images/), written as a stream to `filePath`:
   * memory stays flat whatever the size of the library. Media files are stored as they are
   * (already compressed), data.json is deflated.
   * @param {string} filePath - ZIP to write.
   * @returns {Promise<{filename: string, type: string}>} Download name and type.
   */
  async writeFullExport(filePath) {
    const exportData = await this.collectExportData();
    const out = fs.createWriteStream(filePath);
    const finished = new Promise((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', reject);
    });
    const zip = new Zip((error, chunk, final) => {
      if (error) return out.destroy(error);
      out.write(chunk);
      if (final) out.end();
    });
    // Waits when the disk is slower than the reads
    const drained = () => (out.writableNeedDrain ? once(out, 'drain') : null);

    const data = new ZipDeflate('data.json', { level: 6 });
    zip.add(data);
    data.push(Buffer.from(JSON.stringify(exportData, null, 2)), true);

    for (const file of await listFiles(ENV_CONFIG.UPLOADS_DIR)) {
      const entry = new ZipPassThrough(`images/${path.relative(ENV_CONFIG.UPLOADS_DIR, file).split(path.sep).join('/')}`);
      entry.mtime = (await fs.promises.stat(file)).mtime;
      zip.add(entry);
      for await (const chunk of fs.createReadStream(file)) {
        entry.push(chunk);
        await drained();
      }
      entry.push(new Uint8Array(0), true);
    }
    zip.end();
    await finished;
    return { filename: `imagitales-full-export-${new Date().toISOString().slice(0, 10)}.zip`, type: 'application/zip' };
  }

  /**
   * Scan for and remove unused illustration files.
   * @param {Object} [options]
   * @param {number} [options.minAgeMs=0] - Only remove files older than this. Images uploaded on the
   *   create page are unreferenced until the story is saved: the automatic purge gives them time.
   * @returns {Promise<{success: boolean, deletedCount: number, reclaimedSpace: number}>} Cleanup stats.
   */
  async cleanupImages({ minAgeMs = 0 } = {}) {
    const illustrations = await query('SELECT image_path FROM illustrations');
    const audios = await query('SELECT audio_path FROM stories WHERE audio_path IS NOT NULL');
    // Stored paths may use "\" (legacy Windows rows) or "/", audio paths start with "/": compare in "uploads/..." form
    const usedPaths = new Set([
      ...illustrations.map(i => i.image_path),
      ...audios.map(a => a.audio_path)
    ].filter(p => p).map(p => p.replace(/\\/g, '/').replace(/^\/+/, '')));
    const uploadsDir = ENV_CONFIG.UPLOADS_DIR;
    let deletedCount = 0;
    let reclaimedSpace = 0;

    if (!fs.existsSync(uploadsDir)) return { success: true, deletedCount: 0, reclaimedSpace: 0 };

    // Asynchronous walk: the hourly purge never blocks the requests
    const walkDir = async (dir) => {
      for (const file of await fs.promises.readdir(dir)) {
        const filePath = path.join(dir, file);
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
          await walkDir(filePath);
          if ((await fs.promises.readdir(filePath)).length === 0) await fs.promises.rmdir(filePath);
        } else {
            const oldEnough = Date.now() - stat.mtimeMs >= minAgeMs;
            if (oldEnough && !usedPaths.has(toStoredPath(filePath))) {
                try {
                    await fs.promises.unlink(filePath);
                    deletedCount++;
                    reclaimedSpace += stat.size;
                } catch (err) {}
            }
        }
      }
    };
    await walkDir(uploadsDir);
    return { success: true, deletedCount, reclaimedSpace };
  }

  /**
   * Library counts and disk usage (Settings > Storage).
   * @returns {Promise<{counts: Object<string, number>, disk: {uploads: DirUsage, logs: DirUsage, debugLog: DirUsage}}>}
   *   DirUsage = {files: number, bytes: number}.
   */
  async getStats() {
    const tables = { stories: 'stories', versions: 'story_versions', illustrations: 'illustrations', series: 'story_series', themes: 'themes', weeklyThemes: 'weekly_themes' };
    const counts = {};
    for (const [key, table] of Object.entries(tables)) {
      const [row] = await query(`SELECT COUNT(*) AS total FROM ${table}`);
      counts[key] = Number(row?.total ?? 0);
    }
    return {
      counts,
      disk: {
        uploads: await dirUsage(ENV_CONFIG.UPLOADS_DIR),
        logs: await dirUsage(ENV_CONFIG.LOGS_DIR),
        debugLog: await dirUsage(ENV_CONFIG.DEBUG_LOG_DIR)
      }
    };
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
        await connection.query('DELETE FROM story_series');
        await connection.query('DELETE FROM themes');
        // The generation history points at the deleted stories (units follow by cascade).
        // The quota statistics stay: they describe requests really sent.
        await connection.query('DELETE FROM generation_jobs');
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      themeService.invalidateCache();
      // Nothing references the uploaded images / audio anymore: reclaim the space
      await this.cleanupImages();
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
      // e.g. "uploads/2026-10/<uuid>-name.png", always with "/"
      const relativePath = toStoredPath(filePath);
      
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
  async getLogsList(type = 'all') {
      const logsDir = ENV_CONFIG.LOGS_DIR;
      if (!fs.existsSync(logsDir)) return [];
      
      const files = await fs.promises.readdir(logsDir);
      return files
          .filter(f => f.endsWith('.log'))
          .map(f => {
              let logType = 'unknown';
              let date = '';
              
              if (f.startsWith('access-')) {
                  logType = 'access';
                  date = f.replace('access-', '').replace('.log', '');
              } else if (f.startsWith('ai-')) {
                  logType = 'ai';
                  date = f.replace('ai-', '').replace('.log', '');
              }
              
              return {
                  filename: f,
                  date: date,
                  type: logType,
                  size: fs.statSync(path.join(logsDir, f)).size
              };
          })
          .filter(f => (type === 'all' || f.type === type) && f.type !== 'unknown')
          .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Get content of a specific log file.
   * @param {string} filename - Log filename.
   * @returns {Promise<Array<Object>>} Parsed log entries.
   * @throws {Error} If file not found.
   */
  async getLogContent(filename) {
      const logsDir = ENV_CONFIG.LOGS_DIR;
      // Security check: prevent directory traversal
      const safeFilename = path.basename(filename); 
      const filePath = path.join(logsDir, safeFilename);

      if (!fs.existsSync(filePath)) {
          throw new Error('Log file not found');
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      // Parse NDJSON (Newlines Delimited JSON)
      return lines.map(line => {
          try { return JSON.parse(line); } catch (e) { return null; }
      }).filter(Boolean).reverse(); // Newest first
  }

  /**
   * Get current log configuration.
   * @returns {Object} Config object.
   */
  getLogConfig() {
      return logger.getConfig();
  }

  /**
   * Update log configuration.
   * @param {Object} config - New config values.
   * @returns {Object} Updated config.
   */
  updateLogConfig(config) {
      return logger.updateConfig(config);
  }
}

export const systemService = new SystemService();
