import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { systemService } from './system.service.js';
import { backupService } from './backup.service.js';
import { settingsService } from './settings.service.js';
import { aiUsageService } from './ai_usage.service.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const BACKUP_INTERVAL_MS = { daily: DAY_MS, weekly: 7 * DAY_MS };
// Server log files are dated by name: access-2026-10-09.log, ai-2026-10-09.log
const DATED_LOG_RE = /^(?:access|ai)-(\d{4}-\d{2}-\d{2})\.log$/;

/**
 * Hourly housekeeping driven by Settings > Storage. Each step is independent: one failure never
 * blocks the others nor the server.
 */
class MaintenanceService {
  /**
   * @param {Date} [now]
   * @returns {Promise<{backup: string|null, purgedFiles: number, deletedLogs: string[]}>}
   */
  async run(now = new Date()) {
    const { autoBackup, orphanPurge, logRetentionDays } = settingsService.storage;
    const report = { backup: null, purgedFiles: 0, deletedLogs: [] };

    if (autoBackup.enabled) {
      try {
        if (await this.isBackupDue(now)) {
          report.backup = (await backupService.runBackup({ keep: autoBackup.keep })).filename;
          logger.info(`Automatic backup written: ${report.backup}`);
        }
      } catch (error) {
        logger.error('Automatic backup failed:', {}, error);
      }
    }

    if (orphanPurge.enabled) {
      try {
        // Images uploaded on the create page stay unreferenced until the story is saved: keep the recent ones
        const { deletedCount, reclaimedSpace } = await systemService.cleanupImages({ minAgeMs: orphanPurge.maxAgeHours * HOUR_MS });
        report.purgedFiles = deletedCount;
        if (deletedCount > 0) logger.info(`Orphan uploads purged: ${deletedCount} file(s), ${reclaimedSpace} bytes.`);
      } catch (error) {
        logger.error('Orphan uploads purge failed:', {}, error);
      }
    }

    try {
      report.deletedLogs = await this.deleteOldLogs(logRetentionDays, now);
      // The quota statistics follow the same retention
      await aiUsageService.purge(logRetentionDays);
    } catch (error) {
      logger.error('Old logs cleanup failed:', {}, error);
    }

    return report;
  }

  /** True when there is no backup yet, or the last one is older than the chosen frequency. */
  async isBackupDue(now = new Date()) {
    const last = await backupService.lastBackupDate();
    const interval = BACKUP_INTERVAL_MS[settingsService.storage.autoBackup.frequency];
    return !last || now.getTime() - last.getTime() >= interval;
  }

  /**
   * Deletes the dated access / AI log files older than `retentionDays`.
   * @returns {Promise<string[]>} Deleted file names.
   */
  async deleteOldLogs(retentionDays, now = new Date()) {
    const dir = ENV_CONFIG.LOGS_DIR;
    if (!fs.existsSync(dir)) return [];
    const limit = now.getTime() - retentionDays * DAY_MS;
    const deleted = [];
    for (const filename of await fs.promises.readdir(dir)) {
      const date = filename.match(DATED_LOG_RE)?.[1];
      // A day's file is complete at the end of that day (UTC, like the file names)
      if (date && new Date(`${date}T00:00:00Z`).getTime() + DAY_MS <= limit) {
        await fs.promises.unlink(path.join(dir, filename));
        deleted.push(filename);
      }
    }
    return deleted;
  }
}

export const maintenanceService = new MaintenanceService();
