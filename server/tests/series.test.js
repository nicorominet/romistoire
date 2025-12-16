// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Database
vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  closeConnections: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  initializeDatabase: vi.fn(),
}));

// Mock Series Service
vi.mock('../services/series.service.js', () => ({
  seriesService: {
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

import { seriesService } from '../services/series.service.js';
import app from '../app.js';

describe('Series API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/series', () => {
    it('should return all series', async () => {
      const mockSeries = [{ id: '1', name: 'Series 1' }];
      seriesService.findAll.mockResolvedValue(mockSeries);

      const res = await request(app).get('/api/series');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockSeries);
    });
  });

  describe('POST /api/series', () => {
    it('should create a series', async () => {
      const newSeries = { name: 'New Series' };
      seriesService.create.mockResolvedValue({ id: '2', ...newSeries });

      const res = await request(app).post('/api/series').send(newSeries);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(seriesService.create).toHaveBeenCalledWith(expect.objectContaining(newSeries));
    });
  });

  describe('PUT /api/series/:id', () => {
    it('should update a series', async () => {
      const update = { name: 'Updated Series' };
      seriesService.update.mockResolvedValue({ id: '1', ...update });

      const res = await request(app).put('/api/series/1').send(update);

      expect(res.status).toBe(200);
      expect(seriesService.update).toHaveBeenCalledWith('1', update);
    });
  });

  describe('DELETE /api/series/:id', () => {
    it('should delete a series', async () => {
      seriesService.delete.mockResolvedValue(true);

      const res = await request(app).delete('/api/series/1');

      expect(res.status).toBe(200);
      expect(seriesService.delete).toHaveBeenCalledWith('1');
    });
  });
});
