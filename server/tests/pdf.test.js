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

// Mock PDF Service
vi.mock('../lib/pdf/index.js', () => ({
  default: {
    exportPdf: vi.fn((req, res) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.send('%PDF-1.4 mock content');
    }),
  }
}));

// Mock Upload (as PDF route uses it)
vi.mock('../config/upload.config.js', () => ({
    upload: {
        single: () => (req, res, next) => next()
    },
    dataUpload: {
        single: () => (req, res, next) => next()
    }
}));

import PDFExportService from '../lib/pdf/index.js';
import app from '../app.js';

describe('PDF Export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/export/pdf', () => {
    it('should invoke PDF service and return PDF', async () => {
      const res = await request(app)
        .post('/api/export/pdf')
        .send({ title: 'Test Story' });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/pdf');
      expect(PDFExportService.exportPdf).toHaveBeenCalled();
    });
  });
});
