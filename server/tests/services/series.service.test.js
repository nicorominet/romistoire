// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));

const db = await import('../../config/database.js');
const { seriesService, cleanSeriesName } = await import('../../services/series.service.js');
const { storySeriesHelper } = await import('../../services/story_series.helper.js');
const { ConflictError, NotFoundError, ValidationError } = await import('../../middleware/error.middleware.js');

/** Answers the name lookups with `sameName` (the DB collation ignores case and accents) and the id lookups with `ids`. */
const mockSeries = ({ sameName = [], ids = [] } = {}) => {
  db.query.mockImplementation(async (sql, params) => {
    if (sql.startsWith('SELECT id FROM story_series WHERE name')) return sameName;
    if (sql.startsWith('SELECT id FROM story_series WHERE id')) return ids.includes(params[0]) ? [{ id: params[0] }] : [];
    return { affectedRows: 1 };
  });
};

const insertCall = () => db.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO story_series'));

describe('SeriesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cleans and checks the name', () => {
    expect(cleanSeriesName('  Les   Explorateurs ')).toBe('Les Explorateurs');
    expect(() => cleanSeriesName('   ')).toThrow(ValidationError);
    expect(() => cleanSeriesName('x'.repeat(256))).toThrow(ValidationError);
  });

  it('creates a series with a cleaned name', async () => {
    mockSeries();
    const series = await seriesService.create({ name: '  Les Explorateurs ' });

    expect(series.name).toBe('Les Explorateurs');
    expect(insertCall()[1][1]).toBe('Les Explorateurs');
  });

  it('refuses a name already used (case and accents ignored by the database)', async () => {
    mockSeries({ sameName: [{ id: 'existing' }] });

    await expect(seriesService.create({ name: 'les explorateurs' })).rejects.toBeInstanceOf(ConflictError);
    expect(insertCall()).toBeUndefined();
  });

  it('lets a series keep its own name when renamed, refuses the name of another one', async () => {
    mockSeries({ sameName: [{ id: 's1' }], ids: ['s1', 's2'] });

    await expect(seriesService.update('s1', { name: 'Les Explorateurs', description: 'd' })).resolves.toMatchObject({ name: 'Les Explorateurs' });
    await expect(seriesService.update('s2', { name: 'Les Explorateurs' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('answers 404 for an unknown series', async () => {
    mockSeries();
    await expect(seriesService.update('missing', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(seriesService.delete('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('storySeriesHelper.resolveSeriesId', () => {
  it('finds a series by its cleaned name, the main and oldest one first', async () => {
    const connection = { query: vi.fn(async () => [[{ id: 'main' }]]) };

    expect(await storySeriesHelper.resolveSeriesId(connection, null, '  Les  Explorateurs ')).toBe('main');
    const [sql, params] = connection.query.mock.calls[0];
    expect(params).toEqual(['Les Explorateurs']);
    expect(sql).toContain('ORDER BY parent_series_id IS NOT NULL, created_at ASC');
  });

  it('creates the series when the name is new, nothing for a blank name', async () => {
    const connection = { query: vi.fn(async (sql) => (sql.startsWith('SELECT') ? [[]] : [{}])) };

    const id = await storySeriesHelper.resolveSeriesId(connection, null, 'Nouvelle');
    expect(id).toEqual(expect.any(String));
    expect(connection.query.mock.calls[1][0]).toContain('INSERT INTO story_series');
    expect(await storySeriesHelper.resolveSeriesId(connection, null, '   ')).toBeNull();
  });
});
