
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storyService, normalizeStoryThemes } from '../../services/story.service.js';
import * as db from '../../config/database.js';

// Mock the database module
vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

describe('StoryService Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('findAll', () => {
        it('should build correct query for simple fetch', async () => {
            const mockStories = [{ id: '1', title: 'Story 1' }];
            // Mock query response: [rows, fields] usually for mysql2, but our helper returns rows directly?
            // Let's check story.service.js usage.
            // const stories = await query(queryStr, params);
            // It expects array of rows.
            db.query.mockResolvedValue(mockStories);
            
            // We also need to mock the second query for mappedStories (illustrations logic)
            // It does Promise.all(stories.map(...))
            // Inside: query('SELECT ... FROM illustrations ...')
            // So db.query will be called multiple times.
            
            // Mock implementation to return different results based on query content
            db.query.mockImplementation(async (sql, params) => {
                if (sql.includes('COUNT(*)')) return [{ total: 1 }];
                if (sql.includes('FROM stories')) return mockStories;
                if (sql.includes('FROM illustrations')) return [];
                return [];
            });

            const result = await storyService.findAll({ page: 1, limit: 10, locale: 'fr' });
            
            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('1');
            expect(result.total).toBe(1);
            
            // Verify query structure (basics)
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT ? OFFSET ?'), expect.anything());
        });

        it('should filter by age group', async () => {
             db.query.mockImplementation(async (sql, params) => {
                if (sql.includes('COUNT(*)')) return [{ total: 0 }];
                if (sql.includes('FROM stories')) return [];
                return [];
            });

            await storyService.findAll({ ageGroup: '4-6' });
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('AND s.age_group = ?'), expect.arrayContaining(['4-6']));
        });

        it('should filter by search term', async () => {
            db.query.mockImplementation(async (sql, params) => {
               if (sql.includes('COUNT(*)')) return [{ total: 0 }];
               if (sql.includes('FROM stories')) return [];
               return [];
           });

           await storyService.findAll({ search: 'Dragon' });
           expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LIKE ?'), expect.arrayContaining(['%Dragon%']));
       });
    });

    describe('getAvailableWeeks', () => {
        it('should return weeks from DB', async () => {
            const mockWeeks = [{ week_number: '1' }, { week_number: '2' }];
            db.query.mockResolvedValue(mockWeeks);

            const weeks = await storyService.getAvailableWeeks({ locale: 'fr' });
            
            expect(weeks).toEqual(['1', '2']);
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT DISTINCT s.week_number'), expect.anything());
        });
    });

    describe('create', () => {
        it('should store the AI illustration prompt', async () => {
            const connection = {
                query: vi.fn(async () => [[]]),
                beginTransaction: vi.fn(),
                commit: vi.fn(),
                rollback: vi.fn(),
                release: vi.fn()
            };
            db.getConnection.mockResolvedValue(connection);

            await storyService.create({ title: 'T', content: 'C', ageGroup: '4-6', weekNumber: 1, dayOfWeek: 'Monday', locale: 'fr', source: 'gemini', illustrationPrompt: 'Un escargot', themes: [] });

            const insert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO stories'));
            expect(insert[0]).toContain('illustration_prompt');
            expect(insert[1][insert[1].length - 1]).toBe('Un escargot');
        });
    });

    describe('update', () => {
        const oldStory = { id: 'story-1', title: 'T', content: 'C', age_group: '4-6', week_number: 1, day_order: 1, locale: 'fr', version: 2, source: 'manual', series_id: null };

        // slotTaken: whether another story already occupies the target slot
        const setupConnection = ({ existingSeries = [], slotTaken = false } = {}) => {
            const connection = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT * FROM stories')) return [[oldStory]];
                    if (sql.includes('SELECT * FROM story_themes')) return [[]];
                    if (sql.includes('FROM story_series WHERE name')) return [existingSeries];
                    if (sql.includes('SELECT id, series_id FROM stories')) return [slotTaken ? [{ id: 'other', series_id: null }] : []];
                    if (sql.includes('SELECT id FROM stories')) return [[]];
                    if (sql.includes('SELECT id FROM story_versions')) return [[{ id: 'snap' }]];
                    return [[]];
                }),
                beginTransaction: vi.fn(),
                commit: vi.fn(),
                rollback: vi.fn(),
                release: vi.fn()
            };
            db.getConnection.mockResolvedValue(connection);
            db.query.mockResolvedValue([{ max_ver: 2 }]);
            return connection;
        };

        const updateCall = (connection) => connection.query.mock.calls.find(([sql]) => sql.includes('UPDATE stories'));

        it('should persist the selected series', async () => {
            const connection = setupConnection({ existingSeries: [{ id: 'series-a' }] });

            await storyService.update('story-1', { title: 'T', content: 'C', age_group: '4-6', week_number: 1, day_order: 1, locale: 'fr', series_name: 'Série A', themes: [] });

            const [sql, params] = updateCall(connection);
            expect(sql).toContain('series_id = ?');
            expect(params[params.length - 3]).toBe('series-a');
        });

        it('should remove the series when an empty name is sent', async () => {
            oldStory.series_id = 'series-a';
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'T', content: 'C', age_group: '4-6', week_number: 1, day_order: 1, locale: 'fr', series_name: '', themes: [] });

            const [, params] = updateCall(connection);
            expect(params[params.length - 3]).toBeNull();
            oldStory.series_id = null;
        });

        it('should keep the series when the payload has no series field', async () => {
            oldStory.series_id = 'series-a';
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'T2', content: 'C', themes: [] });

            const [, params] = updateCall(connection);
            expect(params[params.length - 3]).toBe('series-a');
            expect(connection.query).not.toHaveBeenCalledWith(expect.stringContaining('SELECT id, series_id FROM stories'), expect.anything());
            oldStory.series_id = null;
        });

        it('should keep the illustration prompt when the payload does not send it', async () => {
            oldStory.illustration_prompt = 'Un escargot sur une feuille';
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'T2', content: 'C', themes: [] });

            const [sql, params] = updateCall(connection);
            expect(sql).toContain('illustration_prompt = ?');
            expect(params[params.length - 2]).toBe('Un escargot sur une feuille');
            delete oldStory.illustration_prompt;
        });

        it('should exclude the story itself when checking slot collisions', async () => {
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'T', content: 'C', age_group: '4-6', week_number: 2, day_order: 1, locale: 'fr', series_name: '', themes: [] });

            const collisionCall = connection.query.mock.calls.find(([sql]) => sql.includes('SELECT id, series_id FROM stories'));
            expect(collisionCall[0]).toContain('AND id <> ?');
            expect(collisionCall[1]).toContain('story-1');
        });

        it('should only collide with stories of the same series', async () => {
            const connection = setupConnection();

            const result = await storyService.update('story-1', { title: 'T', content: 'C', age_group: '4-6', week_number: 2, day_order: 1, locale: 'fr', series_name: 'Les Explorateurs', themes: [] });

            const collisionCall = connection.query.mock.calls.find(([sql]) => sql.includes('SELECT id, series_id FROM stories'));
            expect(collisionCall[0]).toContain('AND series_id = ?');
            expect(collisionCall[0]).not.toContain('series_id IS NULL');
            expect(result.aliasSeries).toBeNull();
        });

        it('should branch into an alias series when the new slot is taken', async () => {
            const connection = setupConnection({ slotTaken: true });

            const result = await storyService.update('story-1', { title: 'T', content: 'C', age_group: '4-6', week_number: 2, day_order: 1, locale: 'fr', series_name: '', themes: [] });

            expect(connection.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO story_series'), expect.arrayContaining(['Série Principale (Alias 1)']));
            // The client is told, so it can warn the user
            expect(result.aliasSeries).toEqual({ id: expect.any(String), name: 'Série Principale (Alias 1)' });
        });
    });

    describe('getNeighbors', () => {
        it('should stay in the same language and cross week boundaries', async () => {
            db.query.mockImplementation(async (sql) => {
                if (sql.includes('WHERE id = ?')) return [{ week_number: 3, day_order: 7, age_group: '4-6', locale: 'fr', series_id: null }];
                if (sql.includes('week_number > ?')) return [{ id: 'next', title: 'Lundi semaine 4' }];
                if (sql.includes('week_number < ?')) return [{ id: 'prev', title: 'Samedi' }];
                return [];
            });

            const result = await storyService.getNeighbors('sunday');

            expect(result).toEqual({ next: { id: 'next', title: 'Lundi semaine 4' }, prev: { id: 'prev', title: 'Samedi' } });
            const nextCall = db.query.mock.calls.find(([sql]) => sql.includes('week_number > ?'));
            expect(nextCall[0]).toContain('locale = ?');
            expect(nextCall[0]).toContain('series_id IS NULL');
            expect(nextCall[0]).toContain('ORDER BY week_number ASC, day_order ASC');
            expect(nextCall[1]).toEqual(['4-6', 'fr', 'sunday', 3, 3, 7]);
        });

        it('should filter on the series when the story has one', async () => {
            db.query.mockImplementation(async (sql) => {
                if (sql.includes('WHERE id = ?')) return [{ week_number: 1, day_order: 1, age_group: '7-9', locale: 'fr', series_id: 's1' }];
                return [];
            });

            const result = await storyService.getNeighbors('a');

            expect(result).toEqual({ next: null, prev: null });
            const nextCall = db.query.mock.calls.find(([sql]) => sql.includes('week_number > ?'));
            expect(nextCall[0]).toContain('series_id = ?');
            expect(nextCall[1]).toEqual(['7-9', 'fr', 's1', 'a', 1, 1, 1]);
        });
    });

    describe('findAll themes', () => {
        it('should keep theme names containing commas intact', async () => {
            db.query.mockImplementation(async (sql) => {
                if (sql.includes('COUNT(*)')) return [{ total: 1 }];
                if (sql.includes('FROM story_themes')) return [
                    { story_id: '1', is_primary: 1, id: 't1', name: 'Pluie, vent et nuages', description: 'Météo', color: '#2196F3' },
                    { story_id: '1', is_primary: 0, id: 't2', name: 'Nature', description: '', color: '#4CAF50' }
                ];
                if (sql.includes('FROM stories')) return [{ id: '1', title: 'Story 1' }];
                return [];
            });

            const result = await storyService.findAll({ page: 1, limit: 10 });

            expect(result.data[0].themes).toEqual([
                { id: 't1', name: 'Pluie, vent et nuages', description: 'Météo', color: '#2196F3', isPrimary: true },
                { id: 't2', name: 'Nature', description: '', color: '#4CAF50', isPrimary: false }
            ]);
            expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('GROUP_CONCAT'), expect.anything());
        });
    });

    describe('normalizeStoryThemes', () => {
        it('should remove duplicates and keep exactly one primary theme', () => {
            expect(normalizeStoryThemes(['a', { id: 'b', isPrimary: true }, 'a', { id: 'c', isPrimary: true }])).toEqual([
                { id: 'a', isPrimary: false },
                { id: 'b', isPrimary: true },
                { id: 'c', isPrimary: false }
            ]);
        });

        it('should make the first theme primary when none is marked', () => {
            expect(normalizeStoryThemes([{ id: 'a' }, { id: 'b' }])).toEqual([
                { id: 'a', isPrimary: true },
                { id: 'b', isPrimary: false }
            ]);
            expect(normalizeStoryThemes(undefined)).toEqual([]);
        });
    });
});
