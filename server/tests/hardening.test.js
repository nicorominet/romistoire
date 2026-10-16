// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import AdmZip from 'adm-zip';
import os from 'os';
import path from 'path';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn(),
  closeConnections: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  initializeDatabase: vi.fn(),
}));

vi.mock('../lib/pdf/index.js', () => ({
  default: { exportPdf: vi.fn((req, res) => res.json({ stories: req.body.stories.length })) }
}));

vi.mock('../services/story.service.js', () => ({
  storyService: { create: vi.fn(async (body) => ({ id: 's1', title: body.title })) }
}));

import app from '../app.js';
import { resetRateLimits } from '../middleware/rateLimit.middleware.js';
import { errorHandler, handleError } from '../middleware/error.middleware.js';
import { isLocalHost, localUrlError } from '../services/helpers/local_url.helper.js';
import { checkZipArchive } from '../services/system.service.js';

beforeEach(() => resetRateLimits());

describe('Security headers', () => {
  it('are sent, without X-Powered-By', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Request body size', () => {
  const big = (size) => 'x'.repeat(size);

  it('refuses a JSON body over 1 MB, with a JSON answer', async () => {
    const res = await request(app).post('/api/stories').send({ title: 'A', content: big(1.2 * 1024 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error).toBeTruthy();
  });

  it('accepts a normal story', async () => {
    const res = await request(app).post('/api/stories').send({ title: 'A', content: big(200 * 1024) });
    expect(res.status).toBe(201);
  });

  it('accepts a PDF export of many stories (several MB)', async () => {
    const stories = Array.from({ length: 300 }, () => ({ title: 'T', content: big(20 * 1024) }));
    const res = await request(app).post('/api/export/pdf').send({ stories });

    expect(res.status).toBe(200);
    expect(res.body.stories).toBe(300);
  });

  it('answers invalid JSON with a JSON 400', async () => {
    const res = await request(app).post('/api/stories').set('Content-Type', 'application/json').send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

describe('POST /api/logs (client logger)', () => {
  const send = (body) => request(app).post('/api/logs').send(body);

  it('accepts a batch of the client logger', async () => {
    const res = await send({ category: 'BATCH_LOGS', message: 'Batch of client logs', level: 'INFO', data: { logs: [{ message: 'x' }] } });
    expect(res.status).toBe(200);
  });

  it.each([
    [{ category: 'BATCH_LOGS', message: 'x', level: 'updateConfig' }],
    [{ category: 'BATCH_LOGS', message: 'x', level: 'constructor' }],
    [{ category: 'not valid!', message: 'x' }],
    [{ category: 'BATCH_LOGS', message: 'x'.repeat(1001) }],
    [{ category: 'BATCH_LOGS' }],
    [{ category: 'BATCH_LOGS', message: 'x', data: { logs: Array.from({ length: 101 }, () => ({})) } }]
  ])('refuses %j', async (body) => {
    expect((await send(body)).status).toBe(400);
  });

  it('is rate limited (429 with Retry-After)', async () => {
    const body = { category: 'BATCH_LOGS', message: 'x' };
    for (let i = 0; i < 120; i++) await send(body);
    const res = await send(body);

    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('Error answers', () => {
  const answer = (error) => {
    const mini = express();
    mini.get('/', (req, res) => handleError(res, error));
    mini.get('/thrown', () => { throw error; });
    mini.use(errorHandler);
    return mini;
  };
  let env;
  beforeEach(() => { env = process.env.NODE_ENV; vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { process.env.NODE_ENV = env; vi.restoreAllMocks(); });

  it('never sends SQL details, gives an error id', async () => {
    const sqlError = Object.assign(new Error("Table 'romitest.secret' doesn't exist"), { sqlMessage: 'x', sql: 'SELECT * FROM secret' });
    const res = await request(answer(sqlError)).get('/');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database error', errorId: expect.stringMatching(/^[0-9a-f]{8}$/) });
  });

  it('hides raw messages in production only', async () => {
    process.env.NODE_ENV = 'production';
    const prod = await request(answer(new Error('secret path /home/x'))).get('/');
    process.env.NODE_ENV = 'development';
    const dev = await request(answer(new Error('Gemini API Key not configured.'))).get('/thrown');

    expect(prod.body.error).toBe('Internal server error');
    expect(dev.body.error).toBe('Gemini API Key not configured.');
  });
});

describe('Ollama URL: this machine or the local network only', () => {
  it.each(['localhost', '127.0.0.1', '10.0.0.5', '172.20.1.1', '192.168.1.10', '[::1]', 'fd12:3456::1', 'nas', 'pc.local', 'host.docker.internal', '::ffff:192.168.0.2'])(
    'accepts %s', (host) => expect(isLocalHost(host)).toBe(true));

  it.each(['169.254.169.254', '8.8.8.8', '172.32.0.1', 'example.com', 'metadata.google.internal.evil.com', 'fe80::1', '::ffff:8.8.8.8', ''])(
    'refuses %s', (host) => expect(isLocalHost(host)).toBe(false));

  it('checks the whole URL', () => {
    expect(localUrlError('http://localhost:11434')).toBeNull();
    expect(localUrlError('file:///etc/passwd')).toMatch(/http/);
    expect(localUrlError('http://169.254.169.254/latest')).toMatch(/local network/);
  });
});

describe('ZIP import limits', () => {
  const dir = path.join(os.tmpdir(), 'romistoire-zip-check');

  it('accepts a normal backup', () => {
    const zip = new AdmZip();
    zip.addFile('data.json', Buffer.from('{}'));
    zip.addFile('images/2026-10/a.png', Buffer.from('png'));
    expect(() => checkZipArchive(zip, dir)).not.toThrow();
  });

  it('refuses too many files or too large once extracted', () => {
    const zip = new AdmZip();
    for (let i = 0; i < 3; i++) zip.addFile(`f${i}.txt`, Buffer.alloc(1000));
    expect(() => checkZipArchive(zip, dir, { maxEntries: 2, maxUncompressedBytes: 1e9 })).toThrow(/files/);
    expect(() => checkZipArchive(zip, dir, { maxEntries: 10, maxUncompressedBytes: 2000 })).toThrow(/too large/);
  });

  it('refuses a path outside the extraction folder', () => {
    const zip = new AdmZip();
    zip.addFile('data.json', Buffer.from('{}'));
    zip.getEntries()[0].entryName = '../../evil.js';
    expect(() => checkZipArchive(zip, dir)).toThrow(/invalid path/);
  });
});
