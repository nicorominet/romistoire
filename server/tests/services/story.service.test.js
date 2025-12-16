
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storyService } from '../../services/story.service.js';
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
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT DISTINCT week_number'), expect.anything());
        });
    });
});
