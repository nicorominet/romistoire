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
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateStoriesTheme: vi.fn(), // Test associations
    getStoriesByTheme: vi.fn(),
    mergeDuplicates: vi.fn(),
  }
}));

import { themeService } from '../services/theme.service.js';
import app from '../app.js';

describe('Theme API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/themes', () => {
    it('should return all themes', async () => {
      const mockThemes = [{ id: '1', name: 'Magic' }];
      themeService.findAll.mockResolvedValue(mockThemes);

      const res = await request(app).get('/api/themes');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockThemes);
    });
  });

  describe('POST /api/themes', () => {
    it('should create a theme', async () => {
      const newTheme = { name: 'Adventure' };
      themeService.create.mockResolvedValue({ id: '2', ...newTheme });

      const res = await request(app).post('/api/themes').send(newTheme);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(themeService.create).toHaveBeenCalledWith(expect.objectContaining(newTheme));
    });
  });
  
  describe('PUT /api/themes/:id', () => {
      it('should update a theme', async () => {
          const update = { name: 'Super Adventure' };
          themeService.update.mockResolvedValue({ id: '2', ...update });
          
          const res = await request(app).put('/api/themes/2').send(update);
          
          expect(res.status).toBe(200);
          expect(themeService.update).toHaveBeenCalledWith('2', update);
      });
  });

  describe('DELETE /api/themes/:id', () => {
    it('should delete a theme', async () => {
      themeService.delete.mockResolvedValue(true);

      const res = await request(app).delete('/api/themes/1');

      expect(res.status).toBe(200);
      expect(themeService.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('PUT /api/themes/:themeId/stories', () => {
      it('should move stories from one theme to another', async () => {
          const newThemeId = 't2';
          themeService.updateStoriesTheme.mockResolvedValue(true);
          
          const res = await request(app)
            .put('/api/themes/t1/stories')
            .send({ newThemeId });
          
          expect(res.status).toBe(200);
          expect(themeService.updateStoriesTheme).toHaveBeenCalledWith('t1', newThemeId);
      });
  });
});

