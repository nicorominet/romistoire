// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Database config
vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  closeConnections: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  initializeDatabase: vi.fn(),
}));

// Mock Theme Service
vi.mock('../services/theme.service.js', () => ({
  themeService: {
    findAll: vi.fn(),
    findDuplicateGroups: vi.fn(),
    getStories: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    approveMany: vi.fn(),
    mergeThemes: vi.fn(),
    invalidateCache: vi.fn(),
  }
}));

import { themeService } from '../services/theme.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../middleware/error.middleware.js';
import app from '../app.js';

describe('Theme API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/themes', () => {
    it('should pass search, sort and quick filters to the service', async () => {
      themeService.findAll.mockResolvedValue([{ id: '1', name: 'Magic' }]);

      const res = await request(app).get('/api/themes?search=mag&sort=usage&needsReview=true');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: '1', name: 'Magic' }]);
      expect(themeService.findAll).toHaveBeenCalledWith({ search: 'mag', sort: 'usage', needsReview: true, unused: false });
    });
  });

  describe('GET /api/themes/duplicates', () => {
    it('should return the duplicate groups', async () => {
      themeService.findDuplicateGroups.mockResolvedValue([[{ id: 'a' }, { id: 'b' }]]);

      const res = await request(app).get('/api/themes/duplicates');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /api/themes', () => {
    it('should answer 201 for a new theme', async () => {
      themeService.create.mockResolvedValue({ theme: { id: '2', name: 'Space' }, existing: false });

      const res = await request(app).post('/api/themes').send({ name: 'Space' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: '2', name: 'Space', existing: false });
    });

    it('should answer 200 with the existing theme for a known name', async () => {
      themeService.create.mockResolvedValue({ theme: { id: '1', name: 'Space' }, existing: true });

      const res = await request(app).post('/api/themes').send({ name: 'space' });

      expect(res.status).toBe(200);
      expect(res.body.existing).toBe(true);
    });

    it('should answer 400 on invalid input', async () => {
      themeService.create.mockRejectedValue(new ValidationError('Theme name is required'));

      const res = await request(app).post('/api/themes').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Theme name is required');
    });
  });

  describe('PUT /api/themes/:id', () => {
    it('should update a theme', async () => {
      themeService.update.mockResolvedValue({ id: '2', name: 'Updated' });

      const res = await request(app).put('/api/themes/2').send({ icon: '🚀' });

      expect(res.status).toBe(200);
      expect(themeService.update).toHaveBeenCalledWith('2', { icon: '🚀' });
    });

    it('should answer 409 with the conflicting theme when the name is taken', async () => {
      themeService.update.mockRejectedValue(new ConflictError('Another theme already has this name', { conflictWith: { id: '1', name: 'Nature' } }));

      const res = await request(app).put('/api/themes/2').send({ name: 'nature' });

      expect(res.status).toBe(409);
      expect(res.body.conflictWith).toEqual({ id: '1', name: 'Nature' });
    });

    it('should answer 404 for an unknown theme', async () => {
      themeService.update.mockRejectedValue(new NotFoundError('Theme not found'));

      const res = await request(app).put('/api/themes/x').send({ name: 'A' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/themes/:id', () => {
    it('should delete a theme, moving its stories to the replacement theme', async () => {
      themeService.delete.mockResolvedValue({ deleted: true, movedStories: 3 });

      const res = await request(app).delete('/api/themes/1?reassignTo=2');

      expect(res.status).toBe(200);
      expect(res.body.movedStories).toBe(3);
      expect(themeService.delete).toHaveBeenCalledWith('1', { reassignTo: '2' });
    });

    it('should answer 409 with the story count when the theme is used', async () => {
      themeService.delete.mockRejectedValue(new ConflictError('Theme is used by stories', { storyCount: 4 }));

      const res = await request(app).delete('/api/themes/1');

      expect(res.status).toBe(409);
      expect(res.body.storyCount).toBe(4);
    });
  });

  describe('POST /api/themes/merge', () => {
    it('should merge the source themes into the target', async () => {
      themeService.mergeThemes.mockResolvedValue({ merged: 2, movedStories: 5, target: { id: 't' } });

      const res = await request(app).post('/api/themes/merge').send({ sourceIds: ['a', 'b'], targetId: 't' });

      expect(res.status).toBe(200);
      expect(res.body.merged).toBe(2);
      expect(themeService.mergeThemes).toHaveBeenCalledWith(['a', 'b'], 't');
    });
  });

  describe('POST /api/themes/bulk-delete', () => {
    it('should delete the unused themes and report the skipped ones', async () => {
      themeService.deleteMany.mockResolvedValue({ deleted: ['a'], skipped: [{ id: 'b', storyCount: 2 }] });

      const res = await request(app).post('/api/themes/bulk-delete').send({ ids: ['a', 'b'] });

      expect(res.status).toBe(200);
      expect(res.body.deleted).toEqual(['a']);
      expect(res.body.skipped).toEqual([{ id: 'b', storyCount: 2 }]);
      expect(themeService.deleteMany).toHaveBeenCalledWith(['a', 'b']);
    });

    it('should answer 400 for an empty list', async () => {
      themeService.deleteMany.mockRejectedValue(new ValidationError('empty'));

      const res = await request(app).post('/api/themes/bulk-delete').send({ ids: [] });

      expect(res.status).toBe(400);
    });

    describe('POST /api/themes/bulk-approve', () => {
      it('should approve the selected themes and return the validated count', async () => {
        themeService.approveMany.mockResolvedValue(3);

        const res = await request(app).post('/api/themes/bulk-approve').send({ ids: ['a', 'b', 'c'] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, validated: 3 });
        expect(themeService.approveMany).toHaveBeenCalledWith(['a', 'b', 'c']);
      });

      it('should answer 400 for an empty list', async () => {
        themeService.approveMany.mockRejectedValue(new ValidationError('empty'));

        const res = await request(app).post('/api/themes/bulk-approve').send({ ids: [] });

        expect(res.status).toBe(400);
      });
    });
  });
});
