// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';

// Mock Database
vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  closeConnections: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  initializeDatabase: vi.fn(),
}));

// Mock System Controller (since it has FS logic, best to mock controller or service methods if possible)
// But System Routes import * as systemController.
// We can mock the controller module directly if we want to avoid FS ops.
vi.mock('../controllers/system.controller.js', () => ({
  importData: vi.fn((req, res) => res.json({ success: true, imported: 10 })),
  exportData: vi.fn((req, res) => res.json({ stories: [] })),
  exportFull: vi.fn((req, res) => res.download('backup.zip')),
  cleanupImages: vi.fn((req, res) => res.json({ cleaned: 5 })),
  resetData: vi.fn((req, res) => res.json({ success: true })),
  uploadImage: vi.fn((req, res) => res.json({ path: '/uploads/image.png' })),
  getLogs: vi.fn((req, res) => res.json(['log1.log'])),
  getLogDetails: vi.fn((req, res) => res.json({ logs: [] })),
  serveImage: vi.fn((req, res) => res.send('image-data')),
}));

// Mock Upload Middleware
vi.mock('../config/upload.config.js', () => ({
  upload: {
      single: () => (req, res, next) => {
          req.file = { path: 'mock-path', filename: 'mock-file' };
          next();
      }
  },
  dataUpload: {
      single: () => (req, res, next) => {
          req.file = { path: 'mock-data-path' };
          next();
      }
  }
}));

import app from '../app.js';
import * as systemController from '../controllers/system.controller.js';

describe('System API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/import-data', () => {
    it('should import data', async () => {
      const res = await request(app)
        .post('/api/import-data')
        .attach('file', Buffer.from('dummy'), 'data.json');
      
      expect(res.status).toBe(200);
      expect(systemController.importData).toHaveBeenCalled();
    });
  });

  describe('GET /api/export-data', () => {
    it('should export data', async () => {
      const res = await request(app).get('/api/export-data');
      expect(res.status).toBe(200);
      expect(systemController.exportData).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/cleanup-images', () => {
    it('should cleanup images', async () => {
      const res = await request(app).delete('/api/cleanup-images');
      expect(res.status).toBe(200);
      expect(systemController.cleanupImages).toHaveBeenCalled();
    });
  });
  
  describe('DELETE /api/reset-data', () => {
      it('should reset data', async () => {
          const res = await request(app).delete('/api/reset-data');
          expect(res.status).toBe(200);
          expect(systemController.resetData).toHaveBeenCalled();
      });
  });
});
