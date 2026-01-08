import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storyVersionService } from '../../services/story_version.service.js';
import { themeService } from '../../services/theme.service.js';
import * as db from '../../config/database.js';

// Mock database
vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

// Mock themeService
vi.mock('../../services/theme.service.js', () => ({
  themeService: {
    invalidateCache: vi.fn()
  }
}));

describe('StoryVersionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('restoreVersion', () => {
        it('should call themeService.invalidateCache() after successful restoration', async () => {
            const mockConnection = {
                query: vi.fn(),
                beginTransaction: vi.fn(),
                commit: vi.fn(),
                rollback: vi.fn(),
                release: vi.fn()
            };
            db.getConnection.mockResolvedValue(mockConnection);

            // Mock version fetch
            mockConnection.query.mockImplementation((sql) => {
                if (sql.includes('SELECT * FROM story_versions')) {
                    return [[{ 
                        id: 'v1', 
                        title: 'Old Title', 
                        content: 'Old Content', 
                        age_group: '4-6', 
                        version: 1, 
                        is_manually_edited: 0 
                    }]];
                }
                if (sql.includes('SELECT * FROM story_version_themes')) {
                    return [[{ theme_id: 't1', is_primary: 1 }]];
                }
                return [];
            });

            await storyVersionService.restoreVersion('story-1', 'v1');

            expect(mockConnection.commit).toHaveBeenCalled();
            expect(themeService.invalidateCache).toHaveBeenCalled();
        });

        it('should not invalidate cache if restoration fails', async () => {
             const mockConnection = {
                query: vi.fn(),
                beginTransaction: vi.fn(),
                commit: vi.fn(),
                rollback: vi.fn(),
                release: vi.fn()
            };
            db.getConnection.mockResolvedValue(mockConnection);

             // Mock error
             mockConnection.query.mockRejectedValue(new Error('DB Error'));

             await expect(storyVersionService.restoreVersion('story-1', 'v1')).rejects.toThrow('DB Error');
             
             expect(mockConnection.rollback).toHaveBeenCalled();
             expect(themeService.invalidateCache).not.toHaveBeenCalled();
        });
    });
});
