// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  closeConnections: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  initializeDatabase: vi.fn(),
}));

vi.mock('../controllers/system.controller.js', () => ({
  importData: vi.fn((req, res) => res.json({ success: true })),
  exportData: vi.fn((req, res) => res.json({ stories: [] })),
  exportFull: vi.fn((req, res) => res.json({})),
  cleanupImages: vi.fn((req, res) => res.json({})),
  resetData: vi.fn((req, res) => res.json({ success: true })),
  uploadImage: vi.fn((req, res) => res.json({})),
  getLogConfig: vi.fn((req, res) => res.json({})),
  updateLogConfig: vi.fn((req, res) => res.json({})),
}));

import app from '../app.js';
import * as systemController from '../controllers/system.controller.js';
import { allowedOrigins } from '../middleware/origin.middleware.js';

describe('API reachable from the app only (no login)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a change requested by another website', async () => {
    const res = await request(app).delete('/api/reset-data').set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(systemController.resetData).not.toHaveBeenCalled();
  });

  it('refuses a cross-site change without Origin header', async () => {
    const res = await request(app).delete('/api/reset-data').set('Sec-Fetch-Site', 'cross-site');

    expect(res.status).toBe(403);
    expect(systemController.resetData).not.toHaveBeenCalled();
  });

  it.each(['http://localhost:8885', 'http://127.0.0.1:8885'])('accepts the Vite dev server (%s)', async (origin) => {
    const res = await request(app).delete('/api/reset-data').set('Origin', origin).set('Sec-Fetch-Site', 'same-origin');

    expect(res.status).toBe(200);
    expect(systemController.resetData).toHaveBeenCalled();
  });

  it('accepts the API serving its own pages, and clients without browser headers (curl, scripts)', async () => {
    const own = await request(app).delete('/api/reset-data').set('Host', 'localhost:3001').set('Origin', 'http://localhost:3001');
    const curl = await request(app).delete('/api/reset-data');

    expect(own.status).toBe(200);
    expect(curl.status).toBe(200);
  });

  it('never lets another website read the answers (CORS)', async () => {
    const foreign = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:8885');

    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:8885');
  });

  it('refuses the preflight of another website', async () => {
    const res = await request(app).options('/api/reset-data')
      .set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'DELETE');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('ALLOWED_ORIGINS replaces the default list', () => {
    expect(allowedOrigins({ ALLOWED_ORIGINS: 'http://a:1, http://b:2' })).toEqual(['http://a:1', 'http://b:2']);
    expect(allowedOrigins({})).toContain('http://localhost:8885');
  });
});
