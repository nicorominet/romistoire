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

const mockRestoreQueries = (mockConnection) => {
    // getNextVersionNumber uses the pooled query helper
    db.query.mockResolvedValue([{ max_ver: 3 }]);

    mockConnection.query.mockImplementation(async (sql) => {
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
        if (sql.includes('SELECT * FROM stories')) {
            return [[{ id: 'story-1', title: 'Current Title', content: 'Current Content', age_group: '4-6', version: 3, is_manually_edited: 1, modified_at: '2026-01-01 10:00:00' }]];
        }
        if (sql.includes('SELECT * FROM story_themes')) {
            return [[{ theme_id: 't2', is_primary: 1 }]];
        }
        if (sql.includes('SELECT id FROM story_versions')) {
            return [[]]; // current version not yet in history
        }
        if (sql.includes('SELECT * FROM story_version_themes')) {
            return [[{ theme_id: 't1', is_primary: 1 }]];
        }
        return [[]];
    });
};

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

            mockRestoreQueries(mockConnection);

            await storyVersionService.restoreVersion('story-1', 'v1');

            expect(mockConnection.commit).toHaveBeenCalled();
            expect(themeService.invalidateCache).toHaveBeenCalled();
        });

        it('should snapshot the current state before restoring and move the version forward', async () => {
            const mockConnection = {
                query: vi.fn(),
                beginTransaction: vi.fn(),
                commit: vi.fn(),
                rollback: vi.fn(),
                release: vi.fn()
            };
            db.getConnection.mockResolvedValue(mockConnection);
            mockRestoreQueries(mockConnection);

            await storyVersionService.restoreVersion('story-1', 'v1');

            const calls = mockConnection.query.mock.calls;
            const snapshotIndex = calls.findIndex(([sql]) => sql.includes('INSERT INTO story_versions'));
            const updateIndex = calls.findIndex(([sql]) => sql.includes('UPDATE stories'));

            expect(snapshotIndex).toBeGreaterThan(-1);
            expect(snapshotIndex).toBeLessThan(updateIndex);
            // Snapshot holds the current (version 3) content
            expect(calls[snapshotIndex][1]).toEqual(expect.arrayContaining(['story-1', 'Current Title', 'Current Content', 3]));
            // Restored content gets max(3) + 1, never rewinds to version 1
            expect(calls[updateIndex][1]).toEqual(['Old Title', 'Old Content', '4-6', expect.any(String), 4, 0, 'story-1']);
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
