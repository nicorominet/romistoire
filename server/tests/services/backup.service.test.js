// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ENV_CONFIG } from '../../config/env.config.js';
import { backupService } from '../../services/backup.service.js';
import { maintenanceService } from '../../services/maintenance.service.js';
import { systemService } from '../../services/system.service.js';
import { settingsService } from '../../services/settings.service.js';
import { NotFoundError, ValidationError } from '../../middleware/error.middleware.js';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));

const DAY_MS = 24 * 60 * 60 * 1000;
const original = { backups: ENV_CONFIG.BACKUPS_DIR, logs: ENV_CONFIG.LOGS_DIR };
let tmpDir;

/** Creates a backup file named after `date`, with that modification time. */
const fakeBackup = (date) => {
  const filename = `imagitales-backup-${date.toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
  const filePath = path.join(ENV_CONFIG.BACKUPS_DIR, filename);
  fs.mkdirSync(ENV_CONFIG.BACKUPS_DIR, { recursive: true });
  fs.writeFileSync(filePath, 'zip');
  fs.utimesSync(filePath, date, date);
  return filename;
};

describe('Backups and maintenance', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagitales-backups-'));
    ENV_CONFIG.BACKUPS_DIR = path.join(tmpDir, 'backups');
    ENV_CONFIG.LOGS_DIR = path.join(tmpDir, 'logs');
    settingsService.reset();
    vi.spyOn(systemService, 'exportData').mockResolvedValue({ buffer: Buffer.from('zip-content') });
    vi.spyOn(systemService, 'cleanupImages').mockResolvedValue({ success: true, deletedCount: 0, reclaimedSpace: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ENV_CONFIG.BACKUPS_DIR = original.backups;
    ENV_CONFIG.LOGS_DIR = original.logs;
    settingsService.reset();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runBackup should write a full export and keep only the most recent ones', async () => {
    const oldest = fakeBackup(new Date('2026-10-01T10:00:00Z'));
    const older = fakeBackup(new Date('2026-10-02T10:00:00Z'));

    const result = await backupService.runBackup({ keep: 2 });

    expect(systemService.exportData).toHaveBeenCalledWith(true);
    expect(result.removed).toEqual([oldest]);
    const names = (await backupService.listBackups()).map((b) => b.filename);
    expect(names).toEqual([result.filename, older]);
    expect(fs.readFileSync(path.join(ENV_CONFIG.BACKUPS_DIR, result.filename), 'utf8')).toBe('zip-content');
  });

  it('resolve should refuse anything that is not a backup name', () => {
    expect(() => backupService.resolve('../../.env')).toThrow(ValidationError);
    expect(() => backupService.resolve('imagitales-backup-2026-10-01T10-00-00.zip')).toThrow(NotFoundError);
  });

  it('maintenance should back up only when enabled and due', async () => {
    const now = new Date('2026-10-09T12:00:00Z');
    expect((await maintenanceService.run(now)).backup).toBeNull(); // disabled by default

    settingsService.update({ storage: { autoBackup: { enabled: true, frequency: 'weekly' } } });
    fakeBackup(new Date(now.getTime() - 3 * DAY_MS));
    expect((await maintenanceService.run(now)).backup).toBeNull(); // last one is 3 days old

    settingsService.update({ storage: { autoBackup: { frequency: 'daily' } } });
    expect((await maintenanceService.run(now)).backup).toMatch(/^imagitales-backup-/);
  });

  it('maintenance should purge orphans with the configured age, or not at all', async () => {
    settingsService.update({ storage: { orphanPurge: { maxAgeHours: 48 } } });
    await maintenanceService.run();
    expect(systemService.cleanupImages).toHaveBeenCalledWith({ minAgeMs: 48 * 60 * 60 * 1000 });

    systemService.cleanupImages.mockClear();
    settingsService.update({ storage: { orphanPurge: { enabled: false } } });
    await maintenanceService.run();
    expect(systemService.cleanupImages).not.toHaveBeenCalled();
  });

  it('maintenance should delete the dated logs older than the retention', async () => {
    fs.mkdirSync(ENV_CONFIG.LOGS_DIR, { recursive: true });
    for (const name of ['access-2026-09-01.log', 'ai-2026-09-01.log', 'access-2026-10-08.log', 'notes.log']) {
      fs.writeFileSync(path.join(ENV_CONFIG.LOGS_DIR, name), '');
    }
    settingsService.update({ storage: { logRetentionDays: 7 } });

    const { deletedLogs } = await maintenanceService.run(new Date('2026-10-09T12:00:00Z'));

    expect(deletedLogs.sort()).toEqual(['access-2026-09-01.log', 'ai-2026-09-01.log']);
    expect(fs.readdirSync(ENV_CONFIG.LOGS_DIR).sort()).toEqual(['access-2026-10-08.log', 'notes.log']);
  });
});
