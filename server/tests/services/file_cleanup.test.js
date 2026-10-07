// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../../config/env.config.js';
import { fileCleanup, resolveStoredFile, LEGACY_AUDIO_DIR } from '../../services/helpers/file_cleanup.helper.js';
import { buildSpeechText, storyService } from '../../services/story.service.js';
import * as db from '../../config/database.js';

vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

describe('File cleanup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('resolveStoredFile', () => {
    it('should resolve image, new audio and legacy audio paths', () => {
      expect(resolveStoredFile('uploads/2026-10/a.png')).toBe(path.join(ENV_CONFIG.UPLOADS_DIR, '2026-10', 'a.png'));
      expect(resolveStoredFile('uploads\\2026-10\\a.png')).toBe(path.join(ENV_CONFIG.UPLOADS_DIR, '2026-10', 'a.png'));
      expect(resolveStoredFile('/uploads/audio/s.wav')).toBe(path.join(ENV_CONFIG.UPLOADS_DIR, 'audio', 's.wav'));
      expect(resolveStoredFile('/audio/s.wav')).toBe(path.join(LEGACY_AUDIO_DIR, 's.wav'));
    });

    it('should refuse paths escaping the managed directories', () => {
      expect(resolveStoredFile('uploads/../package.json')).toBeNull();
      expect(resolveStoredFile('/audio/../../server/app.js')).toBeNull();
      expect(resolveStoredFile('server/app.js')).toBeNull();
      expect(resolveStoredFile(null)).toBeNull();
    });
  });

  describe('removeImageIfUnused', () => {
    it('should delete the file when no illustration references it', async () => {
      db.query.mockResolvedValue([{ total: 0 }]);
      const unlink = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      expect(await fileCleanup.removeImageIfUnused('uploads/2026-10/a.png')).toBe(true);
      expect(unlink).toHaveBeenCalledWith(path.join(ENV_CONFIG.UPLOADS_DIR, '2026-10', 'a.png'));
    });

    it('should keep a file still used by another illustration', async () => {
      db.query.mockResolvedValue([{ total: 1 }]);
      const unlink = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      expect(await fileCleanup.removeImageIfUnused('uploads/2026-10/a.png')).toBe(false);
      expect(unlink).not.toHaveBeenCalled();
    });
  });

  describe('storyService.delete', () => {
    it('should delete the story files after the row', async () => {
      const calls = [];
      db.query.mockImplementation(async (sql) => {
        calls.push(sql);
        if (sql.startsWith('SELECT audio_path')) return [{ audio_path: '/uploads/audio/s.wav' }];
        if (sql.startsWith('SELECT image_path')) return [{ image_path: 'uploads/2026-10/a.png' }];
        if (sql.includes('COUNT(*)')) return [{ total: 0 }];
        return [];
      });
      const unlink = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      await storyService.delete('story-1');

      expect(calls.findIndex(sql => sql.startsWith('DELETE FROM stories'))).toBeLessThan(calls.findIndex(sql => sql.includes('COUNT(*)')));
      expect(unlink).toHaveBeenCalledWith(path.join(ENV_CONFIG.UPLOADS_DIR, '2026-10', 'a.png'));
      expect(unlink).toHaveBeenCalledWith(path.join(ENV_CONFIG.UPLOADS_DIR, 'audio', 's.wav'));
    });
  });
});

describe('storyService.reorderIllustrations', () => {
  const setup = () => {
    const connection = {
      query: vi.fn(async (sql) => (sql.startsWith('SELECT id FROM illustrations') ? [[{ id: 'a' }, { id: 'b' }, { id: 'c' }]] : [[]])),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    db.getConnection.mockResolvedValue(connection);
    db.query.mockResolvedValue([]);
    return connection;
  };

  it('should rewrite positions in the given order', async () => {
    const connection = setup();

    await storyService.reorderIllustrations('story-1', ['c', 'a', 'b']);

    const updates = connection.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE illustrations')).map(([, params]) => params);
    expect(updates).toEqual([[0, 'c', 'story-1'], [1, 'a', 'story-1'], [2, 'b', 'story-1']]);
    expect(connection.commit).toHaveBeenCalled();
  });

  it('should refuse a list that does not match the story illustrations', async () => {
    setup();

    await expect(storyService.reorderIllustrations('story-1', ['a', 'b'])).rejects.toThrow('Illustration list mismatch');
    await expect(storyService.reorderIllustrations('story-1', ['a', 'b', 'x'])).rejects.toThrow('Illustration list mismatch');
  });
});

describe('buildSpeechText', () => {
  it('should not read HTML tags or illustration descriptions aloud', () => {
    const html = '<p>Léo regarde la <strong>pluie</strong>.</p><p>[Illustration: Léo sous un parapluie]</p><p>&gt; **Illustration suggérée :** Un escargot</p><p>Fin&nbsp;!</p>';

    expect(buildSpeechText(html)).toBe('Léo regarde la pluie.\n\nFin !');
  });

  it('should strip markdown illustration lines from plain text', () => {
    const text = 'Il pleut.\n> **Illustration suggérée :** Un escargot\n🎨 Une flaque\nFin.';

    expect(buildSpeechText(text)).toBe('Il pleut.\n\nFin.');
  });
});
