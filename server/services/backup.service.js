import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../config/env.config.js';
import { NotFoundError, ValidationError } from '../middleware/error.middleware.js';
import { systemService } from './system.service.js';
import { settingsService } from './settings.service.js';

// imagitales-backup-2026-10-09T13-05-00.zip (UTC): sorts chronologically by name
export const BACKUP_NAME_RE = /^imagitales-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/;

const backupName = (date = new Date()) =>
  `imagitales-backup-${date.toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;

/**
 * Full backups (data + uploads, same ZIP as Settings > Data > Export) kept in BACKUPS_DIR.
 */
class BackupService {
  /**
   * @returns {Promise<{filename: string, size: number, createdAt: string}[]>} Newest first.
   */
  async listBackups() {
    const dir = ENV_CONFIG.BACKUPS_DIR;
    if (!fs.existsSync(dir)) return [];
    const files = (await fs.promises.readdir(dir)).filter((f) => BACKUP_NAME_RE.test(f));
    const backups = await Promise.all(files.map(async (filename) => {
      const stat = await fs.promises.stat(path.join(dir, filename));
      return { filename, size: stat.size, createdAt: stat.mtime.toISOString() };
    }));
    return backups.sort((a, b) => b.filename.localeCompare(a.filename));
  }

  /**
   * Writes a new backup, then keeps only the `keep` most recent ones.
   * @param {{keep?: number}} [options] - Default: the number set in the settings.
   * @returns {Promise<{filename: string, size: number, createdAt: string, removed: string[]}>}
   */
  async runBackup({ keep = settingsService.storage.autoBackup.keep } = {}) {
    const { buffer } = await systemService.exportData(true);
    await fs.promises.mkdir(ENV_CONFIG.BACKUPS_DIR, { recursive: true });
    const filename = backupName();
    const filePath = path.join(ENV_CONFIG.BACKUPS_DIR, filename);
    // Written next to the target first: an interrupted write never looks like a valid backup
    await fs.promises.writeFile(`${filePath}.tmp`, buffer);
    await fs.promises.rename(`${filePath}.tmp`, filePath);
    const removed = await this.applyRetention(keep);
    return { filename, size: buffer.length, createdAt: new Date().toISOString(), removed };
  }

  /**
   * Deletes the oldest backups beyond `keep`.
   * @returns {Promise<string[]>} Deleted file names.
   */
  async applyRetention(keep) {
    const extra = (await this.listBackups()).slice(keep);
    for (const { filename } of extra) {
      await fs.promises.unlink(path.join(ENV_CONFIG.BACKUPS_DIR, filename));
    }
    return extra.map((b) => b.filename);
  }

  /**
   * Absolute path of an existing backup.
   * @throws {ValidationError} For any name that is not a backup name (no path traversal).
   * @throws {NotFoundError}
   */
  resolve(filename) {
    if (!BACKUP_NAME_RE.test(filename)) throw new ValidationError('Invalid backup name');
    const filePath = path.join(ENV_CONFIG.BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Backup not found');
    return filePath;
  }

  async deleteBackup(filename) {
    await fs.promises.unlink(this.resolve(filename));
  }

  /** Date of the most recent backup, or null. */
  async lastBackupDate() {
    const [latest] = await this.listBackups();
    return latest ? new Date(latest.createdAt) : null;
  }
}

export const backupService = new BackupService();
