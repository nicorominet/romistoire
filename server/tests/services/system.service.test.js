// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ENV_CONFIG } from '../../config/env.config.js';
import { systemService } from '../../services/system.service.js';
import * as db from '../../config/database.js';

vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

const COLUMNS = {
  story_series: ['id', 'title'],
  themes: ['id', 'name', 'normalized_name'],
  weekly_themes: ['week_number', 'topic'],
  stories: ['id', 'title'],
  story_themes: ['id', 'story_id', 'theme_id'],
  story_versions: ['id', 'story_id'],
  story_version_themes: ['id', 'story_version_id', 'theme_id'],
  illustrations: ['id', 'story_id']
};

/** Fake pooled connection: records every statement, answers SHOW COLUMNS / SELECT 1. */
const fakeConnection = (existingIds = []) => {
  const calls = [];
  const connection = {
    calls,
    release: vi.fn(),
    query: vi.fn(async (sql, params = []) => {
      calls.push(sql);
      const show = sql.match(/^SHOW COLUMNS FROM (\w+)/);
      if (show) return [COLUMNS[show[1]].map((Field) => ({ Field }))];
      if (sql.startsWith('SELECT 1')) return [existingIds.includes(params[0]) ? [{ 1: 1 }] : []];
      return [{}];
    })
  };
  return connection;
};

const writeBackup = (data) => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'imagitales-import-')), 'backup.json');
  fs.writeFileSync(filePath, JSON.stringify(data));
  return { filename: 'backup.json', path: filePath, mimetype: 'application/json' };
};

describe('SystemService (settings > data)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue([]);
  });

  it('cleanupImages should report success (the settings page checks it)', async () => {
    const originalDir = ENV_CONFIG.UPLOADS_DIR;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagitales-uploads-'));
    const orphan = path.join(tmpDir, 'orphan.png');
    fs.writeFileSync(orphan, 'x');
    // A fresh file's mtime can be a few ms ahead of Date.now() on Windows
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    fs.utimesSync(orphan, anHourAgo, anHourAgo);
    ENV_CONFIG.UPLOADS_DIR = tmpDir;
    try {
      const result = await systemService.cleanupImages();
      expect(result).toEqual({ success: true, deletedCount: 1, reclaimedSpace: 1 });
    } finally {
      ENV_CONFIG.UPLOADS_DIR = originalDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resetData should also empty the generation history, which points at the deleted stories', async () => {
    const connection = { query: vi.fn(async () => [[]]), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    db.getConnection.mockResolvedValue(connection);
    const cleanup = vi.spyOn(systemService, 'cleanupImages').mockResolvedValue({ success: true, deletedCount: 0, reclaimedSpace: 0 });

    await systemService.resetData();

    const statements = connection.query.mock.calls.map(([sql]) => sql);
    expect(statements).toContain('DELETE FROM story_series');
    expect(statements).toContain('DELETE FROM generation_jobs');
    expect(statements.some(sql => sql.includes('ai_requests'))).toBe(false);
    expect(connection.commit).toHaveBeenCalled();
    cleanup.mockRestore();
  });

  it('exportData should include the version themes', async () => {
    db.query.mockImplementation(async (sql) =>
      sql === 'SELECT * FROM story_version_themes' ? [{ id: 'svt-1' }] : []
    );

    const result = await systemService.exportData(false);
    const data = JSON.parse(result.buffer.toString());

    expect(data.versionThemes).toEqual([{ id: 'svt-1' }]);
    expect(result.filename).toMatch(/^imagitales-data-export-/);
  });

  it('importData should run every statement on one connection, with foreign key checks off', async () => {
    const connection = fakeConnection();
    db.getConnection.mockResolvedValue(connection);

    const result = await systemService.importData(writeBackup({
      stories: [{ id: 's1', title: 'A' }],
      versions: [{ id: 'v1', story_id: 's1' }],
      versionThemes: [{ id: 'svt1', story_version_id: 'v1', theme_id: 't1' }]
    }));

    expect(result).toEqual({ success: true, inserted: 3, skipped: 0, failed: 0 });
    expect(connection.calls[0]).toBe('SET FOREIGN_KEY_CHECKS = 0');
    expect(connection.calls.at(-1)).toBe('SET FOREIGN_KEY_CHECKS = 1');
    expect(connection.calls).toContain('INSERT INTO story_version_themes (id, story_version_id, theme_id) VALUES (?, ?, ?)');
    expect(connection.release).toHaveBeenCalledOnce();
    // Only the theme name lookup may use the pool
    expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT'), expect.anything());
  });

  it('importData should count skipped and failed rows', async () => {
    const connection = fakeConnection(['s1']);
    const base = connection.query.getMockImplementation();
    connection.query.mockImplementation(async (sql, params) => {
      if (sql.startsWith('INSERT INTO stories') && params[0] === 's2') throw new Error('boom');
      return base(sql, params);
    });
    db.getConnection.mockResolvedValue(connection);

    const result = await systemService.importData(writeBackup({
      stories: [{ id: 's1', title: 'exists' }, { id: 's2', title: 'fails' }, { id: 's3', title: 'ok' }]
    }));

    expect(result).toEqual({ success: true, inserted: 1, skipped: 1, failed: 1 });
    expect(connection.release).toHaveBeenCalledOnce();
  });
});
