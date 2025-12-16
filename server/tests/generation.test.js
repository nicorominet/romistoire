// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock DB
vi.mock('../config/database.js', () => ({
    query: vi.fn(),
    getConnection: vi.fn(),
    closeConnections: vi.fn(),
    testConnection: vi.fn().mockResolvedValue(true),
    initializeDatabase: vi.fn(),
  }));

// Mock Gemini Service
vi.mock('../services/gemini.service.js', () => ({
  geminiService: {
    generateStory: vi.fn(),
  }
}));

// Mock PDF Service
vi.mock('../lib/pdf/index.js', () => ({
  default: {
    exportPdf: vi.fn((req, res) => res.send('PDF-CONTENT')),
  }
}));

// Mock Upload
vi.mock('../config/upload.config.js', () => ({
    upload: {
        single: () => (req, res, next) => next()
    },
    dataUpload: {
        single: () => (req, res, next) => next()
    }
}));


import { geminiService } from '../services/gemini.service.js';
import PDFExportService from '../lib/pdf/index.js';
import app from '../app.js';

describe('Generation & Export API', () => {
  describe('POST /api/generate/story', () => {
    it('should generate a story', async () => {
      const mockResult = { title: 'AI Story', content: '...' };
      geminiService.generateStory.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/generate/story')
        .send({ prompt: 'test' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResult);
    });
  });

  describe('POST /api/export/pdf', () => {
    it('should export pdf', async () => {
      const res = await request(app).post('/api/export/pdf').send({});
      
      expect(res.status).toBe(200);
      expect(PDFExportService.exportPdf).toHaveBeenCalled();
    });
  });
});
