
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
        it('should refuse an empty or invalid story with every field in error', async () => {
            const { ValidationError } = await import('../../middleware/error.middleware.js');
            let error;
            try {
                await storyService.create({ title: ' ', content: '<p></p>', ageGroup: '5-8', weekNumber: 0, themes: [] });
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.details.fields).toHaveLength(4);
            expect(db.getConnection).not.toHaveBeenCalled();
        });

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
            const columns = insert[0].match(/\(([^)]*)\)/)[1].split(',').map(c => c.trim());
            const value = (column) => insert[1][columns.indexOf(column)];
            expect(value('illustration_prompt')).toBe('Un escargot');
            // An AI story waits for a human review
            expect(value('review_status')).toBe('to_review');
            expect(value('generation_job_id')).toBeNull();
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
        /** Value sent for a column of the UPDATE ("col = ?" placeholders, in order; literal values skipped). */
        const updatedValue = (connection, column) => {
            const [sql, params] = updateCall(connection);
            const assignments = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE')).split(',').map(a => a.trim());
            const placeholders = assignments.filter(a => a.endsWith('?')).map(a => a.split('=')[0].trim());
            return params[placeholders.indexOf(column)];
        };

        it('should persist the selected series', async () => {
            const connection = setupConnection({ existingSeries: [{ id: 'series-a' }] });

            await storyService.update('story-1', { title: 'T', content: 'C', age_group: '4-6', week_number: 1, day_order: 1, locale: 'fr', series_name: 'Série A', themes: [] });

            const [sql, params] = updateCall(connection);
            expect(sql).toContain('series_id = ?');
            expect(updatedValue(connection, 'series_id')).toBe('series-a');
        });

        it('should remove the series when an empty name is sent', async () => {
            oldStory.series_id = 'series-a';
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'T', content: 'C', age_group: '4-6', week_number: 1, day_order: 1, locale: 'fr', series_name: '', themes: [] });

            expect(updatedValue(connection, 'series_id')).toBeNull();
            oldStory.series_id = null;
        });

        it('should keep the series when the payload has no series field', async () => {
            oldStory.series_id = 'series-a';
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'T2', content: 'C', themes: [] });

            expect(updatedValue(connection, 'series_id')).toBe('series-a');
            expect(connection.query).not.toHaveBeenCalledWith(expect.stringContaining('SELECT id, series_id FROM stories'), expect.anything());
            oldStory.series_id = null;
        });

        it('should keep the illustration prompt when the payload does not send it', async () => {
            oldStory.illustration_prompt = 'Un escargot sur une feuille';
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'T2', content: 'C', themes: [] });

            const [sql, params] = updateCall(connection);
            expect(sql).toContain('illustration_prompt = ?');
            expect(updatedValue(connection, 'illustration_prompt')).toBe('Un escargot sur une feuille');
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

        it('should keep the audio when only the themes change, and delete it when the text changes', async () => {
            const { fileCleanup } = await import('../../services/helpers/file_cleanup.helper.js');
            const remove = vi.spyOn(fileCleanup, 'removeAudioIfUnused').mockResolvedValue(undefined);
            oldStory.audio_path = '/uploads/audio/a.wav';

            let connection = setupConnection();
            await storyService.update('story-1', { title: 'T', content: 'C', themes: [{ id: 't1', isPrimary: true }] });
            expect(updatedValue(connection, 'audio_path')).toBe('/uploads/audio/a.wav');
            expect(remove).not.toHaveBeenCalled();

            connection = setupConnection();
            await storyService.update('story-1', { title: 'T', content: 'C modifié' });
            expect(updatedValue(connection, 'audio_path')).toBeNull();
            expect(remove).toHaveBeenCalledWith('/uploads/audio/a.wav');

            oldStory.audio_path = null;
            remove.mockRestore();
        });

        it('should mark the story as reviewed and keep its themes when none are sent', async () => {
            const connection = setupConnection();

            await storyService.update('story-1', { title: 'Nouveau titre' });

            const [sql] = updateCall(connection);
            expect(sql).toContain("review_status = 'validated'");
            expect(updatedValue(connection, 'content')).toBe('C');
            expect(connection.query).not.toHaveBeenCalledWith('DELETE FROM story_themes WHERE story_id = ?', ['story-1']);
        });

        it('should answer 404 for an unknown story and 400 for an invalid one', async () => {
            const { NotFoundError, ValidationError } = await import('../../middleware/error.middleware.js');
            const connection = setupConnection();
            connection.query.mockImplementationOnce(async () => [[]]);
            await expect(storyService.update('missing', { title: 'T' })).rejects.toBeInstanceOf(NotFoundError);
            await expect(storyService.update('story-1', { content: '<p> </p>' })).rejects.toBeInstanceOf(ValidationError);
            await expect(storyService.update('story-1', { week_number: 60 })).rejects.toBeInstanceOf(ValidationError);
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

describe('generateFromAI', () => {
    it('should log the length of each parsed story against the target of the age', async () => {
        const { geminiService } = await import('../../services/gemini.service.js');
        const { themeService } = await import('../../services/theme.service.js');
        const { logger } = await import('../../services/logger.service.js');
        vi.spyOn(themeService, 'findAll').mockResolvedValue([{ name: 'Nature' }]);
        const ai = vi.spyOn(logger, 'ai').mockImplementation(() => {});
        const generate = vi.spyOn(geminiService, 'generateStory').mockResolvedValue({
            text: JSON.stringify({ stories: [{ day: 'Lundi', title: 'T', summary: 'S', themes: [], paragraphs: ['un deux trois', 'quatre'], illustration_prompt: 'I' }] }),
            model: 'gemini-3.8-flash', finishReason: 'STOP', truncated: false, skipped: []
        });

        const result = await storyService.generateFromAI({ theme: 'Pluie', age: '13-15', day: 'Lundi', weekSeries: true }, 'gemini');

        expect(generate).toHaveBeenCalledWith(expect.objectContaining({ existingThemes: ['Nature'], weekSeries: true }));
        expect(result.targetWords).toEqual({ min: 900, max: 1100 });
        expect(result.weekPlan).toBeNull();
        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.objectContaining({ age: '13-15', weekSeries: true }),
            expect.objectContaining({ model: 'gemini-3.8-flash', parsed: true, stories: 1, words: [4], targetWords: { min: 900, max: 1100 } }));
    });

    it('should return the plan of the week written by the first day', async () => {
        const { geminiService } = await import('../../services/gemini.service.js');
        const { themeService } = await import('../../services/theme.service.js');
        const { logger } = await import('../../services/logger.service.js');
        vi.spyOn(themeService, 'findAll').mockResolvedValue([]);
        vi.spyOn(logger, 'ai').mockImplementation(() => {});
        const plan = ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept'];
        vi.spyOn(geminiService, 'generateStory').mockResolvedValue({
            text: JSON.stringify({ week_plan: plan, stories: [{ day: 'Lundi', title: 'T', summary: 'S', themes: [], paragraphs: ['Texte'], illustration_prompt: 'I' }] }),
            model: 'm', finishReason: 'STOP', truncated: false, skipped: []
        });

        const result = await storyService.generateFromAI({ theme: 'Pluie', age: '4-6', day: 'Lundi', weekSeries: true }, 'gemini');

        expect(result.weekPlan).toEqual(plan);
        expect(result.stories).toHaveLength(1);
    });

    it('should return the character sheets and remove an opening copied from the previous day', async () => {
        const { geminiService } = await import('../../services/gemini.service.js');
        const { themeService } = await import('../../services/theme.service.js');
        const { logger } = await import('../../services/logger.service.js');
        vi.spyOn(themeService, 'findAll').mockResolvedValue([]);
        const ai = vi.spyOn(logger, 'ai').mockImplementation(() => {});
        const ending = 'Papouin regarde le sable mouillé qui garde sa forme ronde.';
        vi.spyOn(geminiService, 'generateStory').mockResolvedValue({
            text: JSON.stringify({
                characters: [{ name: 'Papouin', description: 'Garçon de 5 ans' }],
                stories: [{ day: 'Mardi', title: 'T', summary: 'S', themes: [], paragraphs: [ending, 'Ce mardi, Papouin revient à la plage.'], illustration_prompt: 'I' }]
            }),
            model: 'm', finishReason: 'STOP', truncated: false, skipped: []
        });

        const result = await storyService.generateFromAI({ theme: 'Sable', age: '4-6', day: 'Mardi', weekSeries: true, previousEnding: ending }, 'gemini');

        expect(result.characters).toEqual([{ name: 'Papouin', description: 'Garçon de 5 ans' }]);
        expect(result.stories[0].paragraphs).toEqual(['Ce mardi, Papouin revient à la plage.']);
        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.anything(), expect.objectContaining({ repeatedOpeningRemoved: 1 }));
    });

    const storyText = (words, day = 'Mardi') => JSON.stringify({
        stories: [{ day, title: 'T', summary: 'S', themes: [], paragraphs: [Array.from({ length: words }, (_, i) => `mot${i}`).join(' ')], illustration_prompt: 'I' }]
    });

    const mockGeneration = async (...texts) => {
        const { geminiService } = await import('../../services/gemini.service.js');
        const { themeService } = await import('../../services/theme.service.js');
        const { logger } = await import('../../services/logger.service.js');
        vi.spyOn(themeService, 'findAll').mockResolvedValue([]);
        const ai = vi.spyOn(logger, 'ai').mockImplementation(() => {});
        const generate = vi.spyOn(geminiService, 'generateStory');
        generate.mockReset();
        texts.forEach(text => generate.mockResolvedValueOnce({ text, model: 'm', finishReason: 'STOP', truncated: false, skipped: [] }));
        return { generate, ai };
    };

    it('should ask once more for a story far too short for its age and keep the longer one', async () => {
        const { generate, ai } = await mockGeneration(storyText(100), storyText(650));

        const result = await storyService.generateFromAI({ theme: 'Bateaux', age: '10-12', day: 'Mardi', weekSeries: true }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][0].lengthHint).toContain('100 mots');
        expect(generate.mock.calls[1][0].lengthHint).toContain('au moins 700 mots');
        expect(result.stories[0].paragraphs[0].split(' ')).toHaveLength(650);
        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.anything(), expect.objectContaining({ lengthRetry: { before: 100, after: 650, storiesBefore: 1, storiesAfter: 1 } }));
    });

    it('should not ask again for a story long enough', async () => {
        // 560 words for a minimum of 700: 80 %
        const { generate } = await mockGeneration(storyText(560));

        await storyService.generateFromAI({ theme: 'Bateaux', age: '10-12', day: 'Mardi' }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(1);
    });

    it('should ask again for a story at 70 % of the minimum (the usual shortfall)', async () => {
        const { generate } = await mockGeneration(storyText(490), storyText(720));

        await storyService.generateFromAI({ theme: 'Bateaux', age: '10-12', day: 'Mardi' }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][0].lengthHint).toContain('au moins 700 mots');
    });

    const weekText = (wordsPerDay, paragraphsOf = () => null) => JSON.stringify({
        stories: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day, index) => ({
            day, title: `T${index}`, summary: 'S', themes: [], illustration_prompt: 'I',
            paragraphs: paragraphsOf(index) || [Array.from({ length: wordsPerDay }, (_, i) => `mot${i}`).join(' ')]
        }))
    });

    it('should not ask again for a whole week long enough', async () => {
        const { generate } = await mockGeneration(weekText(320));

        await storyService.generateFromAI({ theme: 'Bateaux', age: '4-6', day: 'Toute la semaine' }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(1);
    });

    it('should ask once more for a whole week whose stories are far too short', async () => {
        const { generate, ai } = await mockGeneration(weekText(100), weekText(330));

        const result = await storyService.generateFromAI({ theme: 'Bateaux', age: '4-6', day: 'Toute la semaine' }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][0].lengthHint).toContain('pour chacune des 7 histoires');
        expect(result.stories).toHaveLength(7);
        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.anything(), expect.objectContaining({ lengthRetry: { before: 100, after: 330, storiesBefore: 7, storiesAfter: 7 } }));
    });

    it('should remove, in a whole week, an opening copied from the previous day', async () => {
        const monday = 'Le petit bateau file vers le pont de pierre, emporté par le courant.';
        const { generate } = await mockGeneration(weekText(320, index => (index === 1
            ? [`${monday} Ce mardi matin, Léo retrouve le bateau coincé dans les roseaux.`, 'Suite.']
            : index === 0 ? ['Début du lundi.', monday] : null)));

        const result = await storyService.generateFromAI({ theme: 'Bateaux', age: '4-6', day: 'Toute la semaine' }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(1);
        expect(result.stories[1].paragraphs[0]).toBe('Ce mardi matin, Léo retrouve le bateau coincé dans les roseaux.');
    });

    it('should count words after removing filler paragraphs, so a padded story is asked again', async () => {
        const words = (count) => Array.from({ length: count }, (_, i) => `mot${i}`).join(' ');
        const padded = JSON.stringify({ stories: [{ day: 'Dimanche', title: 'T', summary: 'S', themes: [], illustration_prompt: 'I', paragraphs: [
            words(300),
            Array.from({ length: 40 }, () => 'Un paragraphe de transition pour atteindre la longueur minimale requise.').join(' ')
        ] }] });
        const { generate, ai } = await mockGeneration(padded, storyText(800, 'Dimanche'));

        const result = await storyService.generateFromAI({ theme: 'Forêt', age: '13-15', day: 'Dimanche', weekSeries: true }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(2);
        expect(result.stories[0].paragraphs[0].split(' ')).toHaveLength(800);
        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.anything(), expect.objectContaining({ lengthRetry: { before: 300, after: 800, storiesBefore: 1, storiesAfter: 1 } }));
    });

    it('should log the stories that open with the reminder of the previous day', async () => {
        const opening = (index) => (index === 0 ? null : [`Hier, Léonie et Antonin avaient trouvé la bogue numéro ${index}.`, Array.from({ length: 320 }, (_, i) => `mot${i}`).join(' ')]);
        const { ai } = await mockGeneration(weekText(320, opening));

        await storyService.generateFromAI({ theme: 'Châtaignes', age: '4-6', day: 'Toute la semaine' }, 'gemini');

        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.anything(), expect.objectContaining({ repetitiveOpenings: 6 }));
    });

    it('should keep the complete week when the first answer has a single story (real Halloween case)', async () => {
        const single = JSON.stringify({ stories: [{ day: 'Lundi', title: 'Le costume magique de Sweety', summary: 'S', themes: [], illustration_prompt: 'I',
            paragraphs: [Array.from({ length: 167 }, (_, i) => `mot${i}`).join(' ')] }] });
        const { generate, ai } = await mockGeneration(single, weekText(240));

        const result = await storyService.generateFromAI({ theme: 'Halloween', age: '4-6', day: 'Toute la semaine' }, 'gemini');

        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][0].lengthHint).toContain('ne contenait que 1 histoire(s)');
        expect(result.stories).toHaveLength(7);
        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.anything(), expect.objectContaining({ incomplete: null }));
    });

    it('should keep a complete week of short stories rather than a single longer story', async () => {
        const single = JSON.stringify({ stories: [{ day: 'Lundi', title: 'T', summary: 'S', themes: [], illustration_prompt: 'I',
            paragraphs: [Array.from({ length: 400 }, (_, i) => `mot${i}`).join(' ')] }] });
        const { result } = await mockGeneration(weekText(100), single).then(async (mocks) => ({
            ...mocks, result: await storyService.generateFromAI({ theme: 'Halloween', age: '4-6', day: 'Toute la semaine' }, 'gemini')
        }));

        expect(result.stories).toHaveLength(7);
    });

    it('should log a week that stays incomplete after the second try', async () => {
        const single = JSON.stringify({ stories: [{ day: 'Lundi', title: 'T', summary: 'S', themes: [], illustration_prompt: 'I',
            paragraphs: [Array.from({ length: 320 }, (_, i) => `mot${i}`).join(' ')] }] });
        const { ai } = await mockGeneration(single, single);

        await storyService.generateFromAI({ theme: 'Halloween', age: '4-6', day: 'Toute la semaine' }, 'gemini');

        expect(ai).toHaveBeenCalledWith('Gemini', 'Story-Parsed', expect.anything(), expect.objectContaining({ incomplete: { stories: 1, expected: 7 } }));
    });
});

