import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../config/env.config.js';

/**
 * The one place the server writes its log files:
 * - server/debug/logs.jsonl: application log (categories, levels; SQL, client logs, server messages),
 * - server/logs/access-<date>.log: HTTP requests, server/logs/ai-<date>.log: AI exchanges (dated, purged by
 *   the maintenance after Settings > Storage > log retention).
 * One JSON object per line. Nothing is written during test runs (ENV_CONFIG.FILE_LOGGING).
 */

const createdDirs = new Set();

/** Path of today's dated log file: "access" or "ai" (UTC date, like the maintenance purge). */
export const datedLogFile = (type, date = new Date()) =>
  path.join(ENV_CONFIG.LOGS_DIR, `${type}-${date.toISOString().slice(0, 10)}.log`);

/**
 * Appends one JSON line; the folder is created on the first write (a fresh clone has none).
 * @param {string} file
 * @param {Object} entry
 */
export const appendLogLine = (file, entry) => {
  if (!ENV_CONFIG.FILE_LOGGING) return;
  const dir = path.dirname(file);
  if (!createdDirs.has(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      createdDirs.add(dir);
    } catch (err) {
      console.error('Failed to create log directory:', err);
      return;
    }
  }
  fs.appendFile(file, JSON.stringify(entry) + '\n', (err) => {
    if (err) console.error(`Failed to write to ${path.basename(file)}:`, err);
  });
};
