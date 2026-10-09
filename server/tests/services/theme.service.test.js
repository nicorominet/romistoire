import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../config/database.js';
import { themeService } from '../../services/theme.service.js';
import { mergeThemesOnConnection } from '../../services/helpers/theme_merge.helper.js';
import { ConflictError, NotFoundError, ValidationError } from '../../middleware/error.middleware.js';

vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

const row = (overrides = {}) => ({
  id: 't1', name: 'Nature', description: '', icon: null, color: '#4CAF50',
  source: 'manual', needs_review: 0, storyCount: 0, created_at: '2026-01-01', updated_at: null,
  ...overrides
});

/** Connection mock: answers SELECTs with `selects(sql, params)`, records every call. */
const mockConnection = (selects = () => []) => {
  const connection = {
    query: vi.fn(async (sql, params) => {
      if (/^\s*SELECT/i.test(sql)) return [selects(sql, params)];
      return [{ affectedRows: 0 }];
    }),
    beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn()
  };
  db.getConnection.mockResolvedValue(connection);
  return connection;
};

describe('ThemeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeService.invalidateCache();
  });

  describe('create', () => {
    it('should return the existing theme for the same name (case, accents, article)', async () => {
      db.query.mockImplementation(async (sql, params) => (sql.includes('normalized_name = ?') && params[0] === 'ocean' ? [row({ name: 'Océan' })] : []));

      const result = await themeService.create({ name: "l'OCEAN" });

      expect(result.existing).toBe(true);
      expect(result.theme.name).toBe('Océan');
      expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO themes'), expect.anything());
    });

    it('should mark AI themes as to review', async () => {
      db.query.mockImplementation(async (sql) => (sql.includes('WHERE t.id = ?') ? [row({ source: 'ai', needs_review: 1 })] : []));

      const result = await themeService.create({ name: 'Volcans', color: '#f00', source: 'ai' });

      const insert = db.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO themes'));
      expect(insert[1]).toEqual([expect.any(String), 'Volcans', 'volcans', '', '#f00', null, 'ai', true, expect.any(String)]);
      expect(result).toEqual({ theme: expect.objectContaining({ needsReview: true, source: 'ai' }), existing: false });
    });

    it('should reject an invalid color or an empty name', async () => {
      await expect(themeService.create({ name: '  ' })).rejects.toBeInstanceOf(ValidationError);
      await expect(themeService.create({ name: 'A', color: 'red' })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('update', () => {
    it('should update only the given fields, keep created_at and clear needs_review', async () => {
      db.query.mockImplementation(async (sql) => (sql.includes('WHERE t.id = ?') ? [row({ needs_review: 1 })] : []));

      await themeService.update('t1', { icon: '🌿' });

      const [sql, params] = db.query.mock.calls.find(([q]) => q.startsWith('UPDATE themes'));
      expect(sql).toBe('UPDATE themes SET icon = ?, needs_review = FALSE, updated_at = ? WHERE id = ?');
      expect(params).toEqual(['🌿', expect.any(String), 't1']);
      expect(sql).not.toContain('created_at');
    });

    it('should refuse a name already used by another theme', async () => {
      db.query.mockImplementation(async (sql) => {
        if (sql.includes('WHERE t.id = ?')) return [row({ id: 't2', name: 'Forêt' })];
        if (sql.includes('normalized_name = ?')) return [row({ id: 't1', name: 'Nature' })];
        return [];
      });

      const error = await themeService.update('t2', { name: 'nature' }).catch(e => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.details).toEqual({ conflictWith: { id: 't1', name: 'Nature' } });
    });

    it('should answer not found for an unknown theme', async () => {
      db.query.mockResolvedValue([]);
      await expect(themeService.update('nope', { name: 'A' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should refuse to delete a used theme without replacement', async () => {
      db.query.mockResolvedValue([row({ storyCount: 3 })]);

      const error = await themeService.delete('t1').catch(e => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.details).toEqual({ storyCount: 3 });
    });

    it('should move the stories to the replacement theme', async () => {
      db.query.mockImplementation(async (sql, params) => (sql.includes('WHERE t.id = ?') ? [row({ id: params[0], storyCount: 3 })] : []));
      const connection = mockConnection();

      const result = await themeService.delete('t1', { reassignTo: 't2' });

      expect(result).toEqual({ deleted: true, movedStories: 3 });
      expect(connection.query).toHaveBeenCalledWith('UPDATE story_themes SET theme_id = ? WHERE theme_id = ?', ['t2', 't1']);
      expect(connection.query).toHaveBeenCalledWith('DELETE FROM themes WHERE id = ?', ['t1']);
      expect(connection.commit).toHaveBeenCalled();
    });

    it('should delete an unused theme directly', async () => {
      db.query.mockResolvedValue([row()]);

      await themeService.delete('t1');

      expect(db.query).toHaveBeenCalledWith('DELETE FROM themes WHERE id = ?', ['t1']);
    });
  });

  describe('deleteMany', () => {
    it('should delete only the unused themes', async () => {
      const connection = mockConnection(() => [{ id: 'a', storyCount: 0 }, { id: 'b', storyCount: '3' }]);

      const result = await themeService.deleteMany(['a', 'b', 'a']);

      expect(result).toEqual({ deleted: ['a'], skipped: [{ id: 'b', storyCount: 3 }] });
      expect(connection.query.mock.calls[0][1]).toEqual(['a', 'b']);
      expect(connection.query).toHaveBeenCalledWith('DELETE FROM themes WHERE id IN (?)', ['a']);
      expect(connection.commit).toHaveBeenCalled();
    });

    it('should not delete anything when every theme is used', async () => {
      const connection = mockConnection(() => [{ id: 'b', storyCount: 1 }]);

      const result = await themeService.deleteMany(['b']);

      expect(result.deleted).toEqual([]);
      expect(connection.query).toHaveBeenCalledTimes(1);
    });

    it('should reject an empty list', async () => {
      await expect(themeService.deleteMany([])).rejects.toBeInstanceOf(ValidationError);
      await expect(themeService.deleteMany('a')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('approveMany', () => {
    it('should validate only pending review themes and invalidate the cache', async () => {
      db.query.mockResolvedValue([{ affectedRows: 2 }]);

      const result = await themeService.approveMany(['a', 'b', 'a']);

      expect(result).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE needs_review = TRUE AND id IN (?, ?)'),
        [expect.any(String), 'a', 'b']
      );
    });

    it('should reject an empty list', async () => {
      await expect(themeService.approveMany([])).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('mergeThemes', () => {
    it('should require a target and another theme', async () => {
      await expect(themeService.mergeThemes(['t1'], 't1')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('findDuplicateGroups', () => {
    it('should group similar names, most used first', async () => {
      db.query.mockResolvedValue([
        row({ id: 'a', name: 'Océan', storyCount: 1 }),
        row({ id: 'b', name: 'les océans', storyCount: 5 }),
        row({ id: 'c', name: 'Amitié' })
      ]);

      const groups = await themeService.findDuplicateGroups();

      expect(groups.map(group => group.map(t => t.id))).toEqual([['b', 'a']]);
    });
  });

  describe('findAll', () => {
    it('should cache the default listing only', async () => {
      db.query.mockResolvedValue([row()]);

      await themeService.findAll();
      await themeService.findAll();
      await themeService.findAll({ sort: 'usage' });

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[1][0]).toContain('ORDER BY storyCount DESC');
    });
  });
});

describe('mergeThemesOnConnection', () => {
  it('should drop duplicate links and keep the primary flag', async () => {
    const connection = mockConnection((sql, params) => {
      // Story s1 has both themes, the source being its primary theme
      if (sql.includes('FROM story_themes s')) return [{ owner: 's1', is_primary: 1 }];
      return [];
    });

    const result = await mergeThemesOnConnection(connection, ['src'], 'dst');

    const calls = connection.query.mock.calls.map(([sql, params]) => [sql.replace(/\s+/g, ' ').trim(), params]);
    expect(calls).toContainEqual(['UPDATE story_themes SET is_primary = TRUE WHERE story_id = ? AND theme_id = ?', ['s1', 'dst']]);
    expect(calls).toContainEqual(['DELETE FROM story_themes WHERE story_id = ? AND theme_id = ?', ['s1', 'src']]);
    expect(calls).toContainEqual(['UPDATE story_version_themes SET theme_id = ? WHERE theme_id = ?', ['dst', 'src']]);
    expect(calls.some(([sql]) => sql.includes('weekly_themes'))).toBe(false);
    expect(calls).toContainEqual(['DELETE FROM themes WHERE id = ?', ['src']]);
    expect(result.merged).toBe(1);
  });

  it('should ignore the target among the sources', async () => {
    const connection = mockConnection();

    const result = await mergeThemesOnConnection(connection, ['dst'], 'dst');

    expect(result.merged).toBe(0);
    expect(connection.query).not.toHaveBeenCalled();
  });
});
