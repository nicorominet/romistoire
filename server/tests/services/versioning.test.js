import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storyVersionService } from '../../services/story_version.service.js';
import * as db from '../../config/database.js';

// Mock database
vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

describe('StoryVersionService Versioning Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getNextVersionNumber', () => {
        it('should return 1 when no versions exist', async () => {
             db.query.mockResolvedValue([{ max_ver: 0 }]);
             const ver = await storyVersionService.getNextVersionNumber('story-1');
             expect(ver).toBe(1);
        });

        it('should return max + 1 when versions exist', async () => {
             db.query.mockResolvedValue([{ max_ver: 5 }]);
             const ver = await storyVersionService.getNextVersionNumber('story-1');
             expect(ver).toBe(6);
        });

        it('should handle null correctly', async () => {
             db.query.mockResolvedValue([{ max_ver: null }]);
             const ver = await storyVersionService.getNextVersionNumber('story-1');
             // null || 0 + 1 = 1
             expect(ver).toBe(1);
        });
    });

    describe('createSnapshot deduplication', () => {
        it('should skip creation if version already exists', async () => {
            const mockConnection = {
                query: vi.fn()
            };

            // Mock check query to return existing row
            mockConnection.query.mockResolvedValueOnce([[{ id: 'existing-id' }]]); 

            const res = await storyVersionService.createSnapshot(mockConnection, { id: 's1', version: 1 }, []);
            
            expect(res).toBe('existing-id');
            // Ensure INSERT was NOT called
            expect(mockConnection.query).toHaveBeenCalledTimes(1); 
            expect(mockConnection.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO story_versions'), expect.anything());
        });

        it('should create snapshot if version does not exist', async () => {
            const mockConnection = {
                query: vi.fn()
            };

            // Mock check query to return empty
            mockConnection.query.mockResolvedValueOnce([[]]); 
            // Mock Insert
            mockConnection.query.mockResolvedValueOnce([]); // story_versions
            // Mock Themes Insert (none in test)

            await storyVersionService.createSnapshot(mockConnection, { id: 's1', version: 1 }, []);
            
            expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO story_versions'), expect.anything());
        });
    });
});
