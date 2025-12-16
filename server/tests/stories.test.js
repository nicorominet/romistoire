// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Database config to prevent connection attempts
vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  closeConnections: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  initializeDatabase: vi.fn(),
}));

// Mock Story Service with inline definition to avoid hoisting issues
vi.mock('../services/story.service.js', () => ({
  storyService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteIllustration: vi.fn(),
    getVersions: vi.fn(),      // Added missing mock
    restoreVersion: vi.fn(),   // Added missing mock
    getAvailableWeeks: vi.fn(),// Added missing mock
    getIllustrations: vi.fn(), // Added missing mock
    getNext: vi.fn(),          // Added missing mock
    getPrevious: vi.fn(),      // Added missing mock
  }
}));

import { storyService } from '../services/story.service.js';

// Import app AFTER mocking
import app from '../app.js';

describe('Story API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/stories', () => {
    it('should return all stories', async () => {
      const mockStories = [{ id: '1', title: 'Story 1' }, { id: '2', title: 'Story 2' }];
      storyService.findAll.mockResolvedValue(mockStories);

      const res = await request(app).get('/api/stories');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockStories);
      expect(storyService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /api/stories/:id', () => {
    it('should return a story by id', async () => {
      const mockStory = { id: '1', title: 'Story 1' };
      storyService.findById.mockResolvedValue(mockStory);

      const res = await request(app).get('/api/stories/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockStory);
      expect(storyService.findById).toHaveBeenCalledWith('1');
    });

    it('should return 404 if story not found', async () => {
      storyService.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/stories/999');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/stories', () => {
    it('should create a new story', async () => {
      const newStory = { title: 'New Story', content: 'Once upon a time...' };
      const createdStory = { id: '123', ...newStory };
      storyService.create.mockResolvedValue(createdStory);

      const res = await request(app)
        .post('/api/stories')
        .send(newStory);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(createdStory);
      expect(storyService.create).toHaveBeenCalledWith(expect.objectContaining(newStory));
    });
  });

  describe('PUT /api/stories/:id', () => {
    it('should update a story', async () => {
        const updateData = { title: 'Updated Title' };
        const updatedStory = { id: '1', ...updateData };
        storyService.update.mockResolvedValue(updatedStory);

        const res = await request(app)
          .put('/api/stories/1')
          .send(updateData);
        
        expect(res.status).toBe(200);
        expect(res.body).toEqual(updatedStory);
        expect(storyService.update).toHaveBeenCalledWith('1', updateData);
    });
  });

  describe('DELETE /api/stories/:id', () => {
    it('should delete a story', async () => {
      storyService.delete.mockResolvedValue(true);

      const res = await request(app).delete('/api/stories/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Story deleted successfully' });
      expect(storyService.delete).toHaveBeenCalledWith('1');
    });
  });
  
  describe('DELETE /api/stories/:id/illustrations/:illustrationId', () => {
     it('should delete an illustration from a story', async () => {
         storyService.deleteIllustration.mockResolvedValue('/path/to/image.png');
         
         const res = await request(app).delete('/api/stories/1/illustrations/img123');
         
         expect(res.status).toBe(200);
         expect(res.body).toEqual({ success: true, message: 'Illustration deleted' });
         expect(storyService.deleteIllustration).toHaveBeenCalledWith('1', 'img123');
     });
  });
  describe('GET /api/stories/available-weeks', () => {
    it('should return available weeks', async () => {
        const weeks = ['2023-W01', '2023-W02'];
        storyService.getAvailableWeeks.mockResolvedValue(weeks);

        const res = await request(app).get('/api/stories/available-weeks');
        
        expect(res.status).toBe(200);
        expect(res.body).toEqual(weeks);
    });
  });

  describe('GET /api/stories/:id/versions', () => {
       it('should return story versions', async () => {
           const versions = [{ id: 'v1' }];
           storyService.getVersions.mockResolvedValue(versions);
           
           const res = await request(app).get('/api/stories/1/versions');
           
           expect(res.status).toBe(200);
           expect(res.body).toEqual(versions);
       });
  });

  describe('POST /api/stories/:id/versions/:versionId', () => {
       it('should restore a version', async () => {
           storyService.restoreVersion.mockResolvedValue(true);
           
           const res = await request(app).post('/api/stories/1/versions/v1');
           
           expect(res.status).toBe(200);
           expect(res.body).toHaveProperty('success', true);
       });
  });

  describe('GET /api/stories/:id/next', () => {
      it('should return next story', async () => {
          const next = { id: '2' };
          storyService.getNext.mockResolvedValue(next);
          
          const res = await request(app).get('/api/stories/1/next');
          
          expect(res.status).toBe(200);
          expect(res.body).toEqual(next);
      });
  });

  describe('GET /api/stories/:id/previous', () => {
      it('should return previous story', async () => {
          const prev = { id: '0' };
          storyService.getPrevious.mockResolvedValue(prev);
          
          const res = await request(app).get('/api/stories/1/previous');
          
          expect(res.status).toBe(200);
          expect(res.body).toEqual(prev);
      });
  });
});
