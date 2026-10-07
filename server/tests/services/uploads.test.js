// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { upload, InvalidFileTypeError } from '../../config/upload.config.js';
import { ENV_CONFIG } from '../../config/env.config.js';
import { systemService, toStoredPath } from '../../services/system.service.js';
import * as db from '../../config/database.js';

vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

const getFilename = (file) => new Promise((resolve, reject) => {
  upload.storage.getFilename({}, file, (err, name) => (err ? reject(err) : resolve(name)));
});

const filterFile = (file) => new Promise((resolve) => {
  upload.fileFilter({}, file, (err, accepted) => resolve({ err, accepted }));
});

describe('Image uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file name', () => {
    it('should take the extension from the validated mimetype, never from the client name', async () => {
      const name = await getFilename({ originalname: 'evil.html', mimetype: 'image/png' });

      expect(name).toMatch(/-evil\.png$/);
      expect(name).not.toContain('.html');
    });

    it('should map jpeg and webp to their extensions', async () => {
      expect(await getFilename({ originalname: 'photo.JPEG', mimetype: 'image/jpeg' })).toMatch(/-photo\.jpg$/);
      expect(await getFilename({ originalname: 'dessin', mimetype: 'image/webp' })).toMatch(/-dessin\.webp$/);
    });
  });

  describe('file filter', () => {
    it('should accept webp images', async () => {
      const { err, accepted } = await filterFile({ mimetype: 'image/webp' });
      expect(err).toBeNull();
      expect(accepted).toBe(true);
    });

    it('should reject other types with a typed error', async () => {
      const { err, accepted } = await filterFile({ mimetype: 'image/svg+xml' });
      expect(err).toBeInstanceOf(InvalidFileTypeError);
      expect(accepted).toBe(false);
    });
  });

  describe('stored path', () => {
    it('should be relative to the project root with "/" separators', () => {
      const absolute = path.join(ENV_CONFIG.UPLOADS_DIR, '2026-10', 'abc-mes_uploads.png');
      expect(toStoredPath(absolute)).toBe('uploads/2026-10/abc-mes_uploads.png');
    });

    it('should store the right path even when the file name contains "uploads"', async () => {
      db.query.mockResolvedValue([]);
      const filePath = path.join(ENV_CONFIG.UPLOADS_DIR, '2026-10', 'abc-uploads.png');

      const result = await systemService.uploadImage(
        { filename: 'abc-uploads.png', path: filePath, mimetype: 'image/png' },
        { storyId: 'story-1', position: 0 }
      );

      expect(result.imagePath).toBe('uploads/2026-10/abc-uploads.png');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO illustrations'),
        expect.arrayContaining(['story-1', 'uploads/2026-10/abc-uploads.png'])
      );
    });
  });

  describe('orphan purge', () => {
    it('should keep recent unreferenced files when minAgeMs is set', async () => {
      const originalDir = ENV_CONFIG.UPLOADS_DIR;
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagitales-uploads-'));
      const oldFile = path.join(tmpDir, 'old.png');
      const recentFile = path.join(tmpDir, 'recent.png');
      fs.writeFileSync(oldFile, 'old');
      fs.writeFileSync(recentFile, 'recent');
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      fs.utimesSync(oldFile, twoDaysAgo, twoDaysAgo);
      db.query.mockResolvedValue([]);

      ENV_CONFIG.UPLOADS_DIR = tmpDir;
      try {
        const result = await systemService.cleanupImages({ minAgeMs: 24 * 60 * 60 * 1000 });

        expect(result.deletedCount).toBe(1);
        expect(fs.existsSync(oldFile)).toBe(false);
        expect(fs.existsSync(recentFile)).toBe(true);
      } finally {
        ENV_CONFIG.UPLOADS_DIR = originalDir;
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
