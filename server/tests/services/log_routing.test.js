import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ENV_CONFIG } from '../../config/env.config.js';
import { appendLogLine, datedLogFile } from '../../lib/logFiles.js';
import { logger } from '../../services/logger.service.js';
import { debugLogFile } from '../../config/logger.js';

const waitForWrites = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('Log files', () => {
  const original = { logs: ENV_CONFIG.LOGS_DIR, debug: ENV_CONFIG.DEBUG_LOG_DIR, fileLogging: ENV_CONFIG.FILE_LOGGING };
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'romistoire-logroute-'));
    ENV_CONFIG.LOGS_DIR = path.join(dir, 'logs');
    ENV_CONFIG.DEBUG_LOG_DIR = path.join(dir, 'debug');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    ENV_CONFIG.LOGS_DIR = original.logs;
    ENV_CONFIG.DEBUG_LOG_DIR = original.debug;
    ENV_CONFIG.FILE_LOGGING = original.fileLogging;
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('appendLogLine creates the folder and writes one JSON line, never during tests by default', async () => {
    const file = path.join(dir, 'new', 'x.log');
    ENV_CONFIG.FILE_LOGGING = false;
    appendLogLine(file, { a: 1 });
    expect(fs.existsSync(file)).toBe(false);

    ENV_CONFIG.FILE_LOGGING = true;
    appendLogLine(file, { a: 1 });
    await waitForWrites();
    expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}\n');
  });

  it('datedLogFile names the file of the day in LOGS_DIR (UTC)', () => {
    expect(datedLogFile('access', new Date('2026-10-16T23:30:00Z'))).toBe(path.join(dir, 'logs', 'access-2026-10-16.log'));
  });

  it('server messages never go to the access log (it lists HTTP requests only)', async () => {
    ENV_CONFIG.FILE_LOGGING = true;
    logger.info('Automatic backup written');
    logger.ai('Gemini', 'Story', { age: '4-6' }, { text: '...' }, { duration: 10 });
    await waitForWrites();

    expect(fs.existsSync(datedLogFile('access'))).toBe(false);
    const ai = fs.readFileSync(datedLogFile('ai'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(ai).toMatchObject([{ type: 'ai', meta: { provider: 'Gemini', type: 'Story' } }]);
    const app = fs.readFileSync(debugLogFile(), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(app).toMatchObject([{ level: 'INFO', category: 'SYSTEM', message: 'Automatic backup written' }]);
  });
});
