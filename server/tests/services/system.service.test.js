// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import { ENV_CONFIG } from '../../config/env.config.js';
import { systemService, EXPORTED_TABLES, NOT_EXPORTED_TABLES, toImportValue } from '../../services/system.service.js';
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
  illustrations: ['id', 'story_id'],
  series_casts: ['id', 'series_id', 'characters', 'updated_at'],
  series_week_recaps: ['cast_id', 'age_group', 'week_number', 'audit']
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
      if (sql.startsWith('SELECT 1')) return [existingIds.includes(params.join(':')) ? [{ 1: 1 }] : []];
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

  it('cleanupImages should preserve recent uploads when a grace period is supplied', async () => {
    const originalRoot = ENV_CONFIG.PROJECT_ROOT;
    const originalDir = ENV_CONFIG.UPLOADS_DIR;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagitales-cleanup-'));
    const uploadsDir = path.join(tmpDir, 'uploads');
    fs.mkdirSync(uploadsDir);
    const recentImage = path.join(uploadsDir, 'recent.png');
    const oldOrphan = path.join(uploadsDir, 'old.png');
    const referencedAudio = path.join(uploadsDir, 'used.mp3');
    fs.writeFileSync(recentImage, 'recent');
    fs.writeFileSync(oldOrphan, 'old');
    fs.writeFileSync(referencedAudio, 'audio');
    const olderThanGrace = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(oldOrphan, olderThanGrace, olderThanGrace);
    ENV_CONFIG.PROJECT_ROOT = tmpDir;
    ENV_CONFIG.UPLOADS_DIR = uploadsDir;
    db.query.mockImplementation(async (sql) => {
      if (sql === 'SELECT image_path FROM illustrations') return [];
      if (sql === 'SELECT audio_path FROM stories WHERE audio_path IS NOT NULL') return [{ audio_path: '/uploads/used.mp3' }];
      return [];
    });

    try {
      const result = await systemService.cleanupImages({ minAgeMs: 24 * 60 * 60 * 1000 });

      expect(result).toEqual({ success: true, deletedCount: 1, reclaimedSpace: 3 });
      expect(fs.existsSync(recentImage)).toBe(true);
      expect(fs.existsSync(oldOrphan)).toBe(false);
      expect(fs.existsSync(referencedAudio)).toBe(true);
    } finally {
      ENV_CONFIG.PROJECT_ROOT = originalRoot;
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
    expect(data).not.toHaveProperty('settings');
    expect(result.filename).toMatch(/^imagitales-data-export-/);
  });

  it('full export should include library data and files from uploads, not application settings', async () => {
    const originalRoot = ENV_CONFIG.PROJECT_ROOT;
    const originalDir = ENV_CONFIG.UPLOADS_DIR;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagitales-export-'));
    const uploadsDir = path.join(tmpDir, 'uploads');
    fs.mkdirSync(uploadsDir);
    fs.writeFileSync(path.join(uploadsDir, 'story.png'), 'image');
    fs.writeFileSync(path.join(uploadsDir, 'story.mp3'), 'audio');
    ENV_CONFIG.PROJECT_ROOT = tmpDir;
    ENV_CONFIG.UPLOADS_DIR = uploadsDir;

    try {
      const result = await systemService.exportData(true);
      const archive = new AdmZip(result.buffer);
      const data = JSON.parse(archive.readAsText('data.json'));

      expect(data).toHaveProperty('weeklyThemes');
      expect(data).toHaveProperty('generationJobs');
      expect(data).not.toHaveProperty('settings');
      expect(archive.getEntry('images/story.png')).not.toBeNull();
      expect(archive.getEntry('images/story.mp3')).not.toBeNull();
    } finally {
      ENV_CONFIG.PROJECT_ROOT = originalRoot;
      ENV_CONFIG.UPLOADS_DIR = originalDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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

  it('exportData should include the bible of the framed series (casts, facts, recaps)', async () => {
    db.query.mockImplementation(async (sql) => ({
      'SELECT * FROM series_casts': [{ id: 'c1' }],
      'SELECT * FROM series_facts': [{ id: 'f1' }],
      'SELECT * FROM series_week_recaps': [{ cast_id: 'c1', age_group: '4-6', week_number: 3 }]
    })[sql] || []);

    const data = JSON.parse((await systemService.exportData(false)).buffer.toString());

    expect(data.seriesCasts).toEqual([{ id: 'c1' }]);
    expect(data.seriesFacts).toEqual([{ id: 'f1' }]);
    expect(data.seriesWeekRecaps).toHaveLength(1);
    expect(data).not.toHaveProperty('aiRequests');
  });

  it('importData should restore the recaps (composite key) and the JSON columns of a cast', async () => {
    const connection = fakeConnection(['c1:4-6:3']);
    db.getConnection.mockResolvedValue(connection);
    const run = connection.query;

    const result = await systemService.importData(writeBackup({
      seriesCasts: [{ id: 'c1', series_id: 's1', characters: [{ name: 'Lila' }], updated_at: '2026-10-09T12:47:05.000Z' }],
      seriesWeekRecaps: [
        { cast_id: 'c1', age_group: '4-6', week_number: 3, audit: { issues: [] } },
        { cast_id: 'c1', age_group: '7-9', week_number: 3, audit: null }
      ]
    }));

    expect(result).toEqual({ success: true, inserted: 2, skipped: 1, failed: 0 });
    expect(run).toHaveBeenCalledWith('INSERT INTO series_casts (id, series_id, characters, updated_at) VALUES (?, ?, ?, ?)',
      ['c1', 's1', '[{"name":"Lila"}]', '2026-10-09 12:47:05']);
    expect(run).toHaveBeenCalledWith('SELECT 1 FROM series_week_recaps WHERE cast_id = ? AND age_group = ? AND week_number = ?', ['c1', '7-9', 3]);
  });
});

describe('Export / backup coverage', () => {
  // Every table created by the init script or a migration
  const schemaTables = () => {
    const configDir = path.join(ENV_CONFIG.PROJECT_ROOT, 'server', 'config');
    const sources = [
      path.join(ENV_CONFIG.PROJECT_ROOT, 'scripts', 'init-db.sql'),
      ...fs.readdirSync(configDir).filter((f) => f.endsWith('.js')).map((f) => path.join(configDir, f))
    ];
    const names = sources.flatMap((file) =>
      [...fs.readFileSync(file, 'utf8').matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)].map((m) => m[1]));
    return [...new Set(names)];
  };

  it('every table of the schema is exported, or explicitly left out', () => {
    const covered = new Set([...EXPORTED_TABLES.map((t) => t.table), ...NOT_EXPORTED_TABLES]);
    const tables = schemaTables();
    expect(tables).toEqual(expect.arrayContaining(['stories', 'series_casts', 'series_week_recaps']));
    expect(tables.filter((table) => !covered.has(table))).toEqual([]);
  });

  it('toImportValue converts dates and JSON values', () => {
    expect(toImportValue('created_at', '2026-10-09T12:47:05.123Z')).toBe('2026-10-09 12:47:05');
    expect(toImportValue('updated_at', 'not a date')).toBe('not a date');
    expect(toImportValue('characters', [{ name: 'A' }])).toBe('[{"name":"A"}]');
    expect(toImportValue('audit', null)).toBeNull();
    expect(toImportValue('title', '2026-10-09T12:47:05.000Z')).toBe('2026-10-09T12:47:05.000Z');
  });
});
