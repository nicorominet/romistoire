// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/logger.service.js', () => ({ logger: { ai: vi.fn(), info: vi.fn(), error: vi.fn() } }));

process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODELS = 'model-a,model-b';
const db = await import('../../config/database.js');
const { aiUsageService } = await import('../../services/ai_usage.service.js');
const { modelLimits, peakPerMinute, quotaDayStart } = await import('../../services/helpers/model_limits.helper.js');
const { geminiService, modelCooldowns } = await import('../../services/gemini.service.js');
geminiService.apiKey = 'test-key';

const jsonResponse = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
/** Recorded rows, as (model, outcome, http status) */
const recorded = () => db.query.mock.calls
  .filter(([sql]) => sql.startsWith('INSERT INTO ai_requests'))
  .map(([, params]) => ({ model: params[1], outcome: params[3], status: params[4] }));

describe('quota limits and windows', () => {
  it('knows the free tier limits by model family', () => {
    expect(modelLimits('gemini-3.5-flash-lite')).toEqual({ rpm: 15, rpd: 500 });
    expect(modelLimits('gemini-3.8-flash')).toEqual({ rpm: 5, rpd: 20 });
    expect(modelLimits('gemini-3-flash-preview')).toEqual({ rpm: 5, rpd: 20 });
    expect(modelLimits('gemma-4-31b-it')).toEqual({ rpm: 30, rpd: 14400 });
    expect(modelLimits('gemini-2.5-flash-preview-tts')).toEqual({ rpm: 3, rpd: 10 });
    // TTS before Flash Lite: not the 500/day of the text models
    expect(modelLimits('gemini-3.8-flash-lite-tts')).toEqual({ rpm: 3, rpd: 10 });
    expect(modelLimits('gemini-2.5-flash-lite')).toEqual({ rpm: 10, rpd: 20 });
    expect(modelLimits('unknown')).toEqual({ rpm: null, rpd: null });
  });

  it('counts the busiest 60 s window', () => {
    expect(peakPerMinute([])).toBe(0);
    // 4 requests 15-23 s apart: all within one minute (the 3 weeks of the user)
    expect(peakPerMinute([0, 22700, 42100, 56800])).toBe(4);
    expect(peakPerMinute([0, 60000, 120000])).toBe(1);
  });

  it('starts the quota day at midnight, Pacific time', () => {
    // 12:27 UTC on Oct 9 = 05:27 in Los Angeles (UTC-7): the day started at 07:00 UTC
    expect(quotaDayStart(new Date('2026-10-09T12:27:13Z')).toISOString()).toBe('2026-10-09T07:00:00.000Z');
  });
});

describe('AiUsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiUsageService.enabled = true;
  });
  afterEach(() => {
    aiUsageService.enabled = false;
  });

  it('counts the requests left today, a daily quota answer exhausting the model', async () => {
    db.query.mockResolvedValueOnce([
      { model: 'gemini-3.5-flash-lite', used: 500, exhausted: 0 },
      { model: 'gemini-3.8-flash', used: 3, exhausted: 1 },
      { model: 'gemini-3.8-flash-tts', used: 4, exhausted: 0 },
    ]);

    // 3.5 Flash Lite used up, 3.1 Flash Lite untouched (500), 3.8 Flash answered 429, 3.8 Flash TTS 6 of 10 left
    const remaining = await aiUsageService.remainingToday(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.8-flash-tts']);

    expect(remaining).toBe(506);
    expect(await aiUsageService.remainingToday(['unknown-model'])).toBeNull();
    aiUsageService.enabled = false;
    expect(await aiUsageService.remainingToday(['gemini-3.8-flash'])).toBeNull();
  });

  it('computes the use per model, and flags a limit hit', async () => {
    const at = (iso) => new Date(iso);
    db.query.mockResolvedValueOnce([
      { at: at('2026-10-09T12:27:13Z'), model: 'gemini-3.5-flash-lite', outcome: 'ok' },
      { at: at('2026-10-09T12:27:36Z'), model: 'gemini-3.5-flash-lite', outcome: 'ok' },
      { at: at('2026-10-09T12:27:55Z'), model: 'gemini-3.5-flash-lite', outcome: 'ok' },
      { at: at('2026-10-09T12:28:10Z'), model: 'gemini-3.5-flash-lite', outcome: 'ok' },
      { at: at('2026-10-08T10:00:00Z'), model: 'gemini-3.8-flash', outcome: 'rate_limit' },
    ]);

    const usage = await aiUsageService.usage({ days: 7, now: new Date('2026-10-09T13:00:00Z') });

    const lite = usage.models.find(m => m.model === 'gemini-3.5-flash-lite');
    expect(lite).toMatchObject({
      limits: { rpm: 15, rpd: 500 },
      today: { requests: 4, ok: 4, peakPerMinute: 4, rateLimited: 0 },
      exceeded: false
    });
    const flash = usage.models.find(m => m.model === 'gemini-3.8-flash');
    expect(flash.today.requests).toBe(0);
    expect(flash.period).toMatchObject({ rateLimited: 1, lastLimitedAt: '2026-10-08T10:00:00.000Z' });
    expect(flash.exceeded).toBe(true);
  });

  it('records every Gemini attempt with its outcome', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'Quota exceeded: GenerateRequestsPerDayPerProjectPerModel' } }))
      .mockResolvedValueOnce(jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'Histoire' }] }, finishReason: 'STOP' }] }));
    modelCooldowns.clear();
    db.query.mockResolvedValue([]);

    const done = geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' });
    await vi.runAllTimersAsync();
    await done;
    vi.useRealTimers();

    expect(recorded()).toEqual([
      { model: 'model-a', outcome: 'daily_quota', status: 429 },
      { model: 'model-b', outcome: 'ok', status: 200 },
    ]);
  });

  it('imports the answered requests of the AI logs once, when the table is empty', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagitales-ai-logs-'));
    const line = (type, model, duration) => JSON.stringify({ timestamp: '2026-10-09T12:27:36.300Z', meta: { provider: 'Gemini', type, duration, output: model ? { model } : { error: 'x' } } });
    fs.writeFileSync(path.join(dir, 'ai-2026-10-09.log'), [
      line('Story', 'gemini-3.5-flash-lite', 22700),
      line('Story-Parsed', 'gemini-3.5-flash-lite'),
      line('Story-Error', null, 100),
      'not json',
    ].join('\n'));
    try {
      db.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValue({});
      expect(await aiUsageService.importFromAiLogs(dir)).toBe(1);
      const [, params] = db.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO ai_requests'));
      // Start of the request = end - duration
      expect(params.slice(0, 4)).toEqual(['2026-10-09 12:27:13.600', 'gemini-3.5-flash-lite', 'Story', 'ok']);

      db.query.mockReset().mockResolvedValueOnce([{ total: 3 }]);
      expect(await aiUsageService.importFromAiLogs(dir)).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
