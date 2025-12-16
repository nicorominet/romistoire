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

// Mock WeeklyTheme Service
vi.mock('../services/weeklyTheme.service.js', () => ({
  weeklyThemeService: {
    findAll: vi.fn(),
    update: vi.fn(),
  }
}));

import { weeklyThemeService } from '../services/weeklyTheme.service.js';
import app from '../app.js';

describe('WeeklyTheme API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/weekly-themes', () => {
    it('should return weekly themes', async () => {
      const mockThemes = [{ id: '1', name: 'Week 1' }];
      weeklyThemeService.findAll.mockResolvedValue(mockThemes);

      const res = await request(app).get('/api/weekly-themes');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockThemes);
    });
  });

  describe('POST /api/weekly-themes', () => {
    it('should update weekly themes', async () => {
      const themes = [{ week: 1, themeId: 't1' }];
      weeklyThemeService.update.mockResolvedValue(themes);

      const res = await request(app).post('/api/weekly-themes').send({ themes });

      expect(res.status).toBe(200);
      expect(weeklyThemeService.update).toHaveBeenCalledWith({ themes });
    });
  });
});
