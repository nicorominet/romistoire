// @vitest-environment node
// Week audits: Flash Lite then Gemma models of the configured list, never Flash; counted in the quota statistics.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/logger.service.js', () => ({ logger: { ai: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const db = await import('../../config/database.js');
const { auditModels, geminiService } = await import('../../services/gemini.service.js');
const { aiUsageService } = await import('../../services/ai_usage.service.js');
const { seriesAuditService } = await import('../../services/series_audit.service.js');

const CONFIGURED = [
  'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash',
  'gemma-4-31b-it', 'gemma-4-26b-a4b-it'
];

describe('audit models', () => {
  it('takes the Flash Lite then Gemma models of the list, never Flash', () => {
    expect(auditModels(CONFIGURED)).toEqual(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it']);
  });

  it('keeps the configured list when it has neither', () => {
    expect(auditModels(['gemini-3.8-flash'])).toEqual(['gemini-3.8-flash']);
  });

  it('asks Gemini with them', async () => {
    const generate = vi.spyOn(geminiService, 'generateText').mockResolvedValue({ text: '{"issues":[],"recap":"r","new_facts":[]}', model: 'gemini-3.5-flash-lite' });
    geminiService.apiKey = 'k';
    await seriesAuditService.auditWeek({
      cast: { characters: [{ name: 'Léonie', role: 'main' }] }, weekNumber: 43, ageGroup: '2-3',
      stories: [{ day: 'Lundi', title: 'T', content: '<p>Léonie joue.</p>' }]
    });
    expect(generate.mock.calls[0][2]).toBe('WeekAudit');
    expect(generate.mock.calls[0][3].models).toEqual(auditModels());
    expect(generate.mock.calls[0][3].models.some(model => /-flash(-preview)?$/.test(model))).toBe(false);
    generate.mockRestore();
  });
});

describe('quota statistics', () => {
  it('counts the week audits per model', async () => {
    aiUsageService.enabled = true;
    const at = new Date('2026-10-11T20:00:00Z');
    db.query.mockResolvedValueOnce([
      { at, model: 'gemini-3.5-flash-lite', outcome: 'ok', label: 'Story' },
      { at, model: 'gemini-3.5-flash-lite', outcome: 'ok', label: 'WeekAudit' },
      { at, model: 'gemini-3.5-flash-lite', outcome: 'ok', label: 'WeekAudit' }
    ]);
    const usage = await aiUsageService.usage({ days: 7, now: new Date('2026-10-11T21:00:00Z') });
    expect(usage.models[0].today).toMatchObject({ requests: 3, audits: 2 });
    expect(usage.models[0].period.audits).toBe(2);
    aiUsageService.enabled = false;
  });
});
