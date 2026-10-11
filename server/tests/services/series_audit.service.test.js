// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/gemini.service.js', () => ({ geminiService: { apiKey: 'k', generateText: vi.fn() }, auditModels: () => ['gemini-3.5-flash-lite', 'gemma-4-31b-it'] }));
vi.mock('../../services/local_llm.service.js', () => ({ localLLMService: { generateText: vi.fn() } }));
vi.mock('../../services/weeklyTheme.service.js', () => ({ weeklyThemeService: { findByWeek: vi.fn(async () => ({ theme_name: 'Les volcans' })) } }));
vi.mock('../../services/generation_job.repository.js', () => ({
  generationJobRepository: {
    existingStories: vi.fn(),
    seriesNames: vi.fn(async () => ['Les Martin', 'Antonin', 'Léo'])
  }
}));
vi.mock('../../services/series_cast.service.js', () => ({
  seriesCastService: {
    get: vi.fn(async () => ({
      id: 'cast1', seriesId: 'ser1', version: 2, ageGroups: ['4-6'], referenceWeek: 1, rules: [],
      characters: [{ key: 'leo', name: 'Léo', role: 'main', age: 5, physical: { hair: 'bruns' }, relations: [] }]
    })),
    seriesName: vi.fn(async () => 'Les Martin'),
    factsBefore: vi.fn(async () => []),
    saveRecap: vi.fn(),
    replaceProposedFacts: vi.fn(),
    markStaleAfter: vi.fn(async () => 2)
  }
}));

const { geminiService } = await import('../../services/gemini.service.js');
const repo = (await import('../../services/generation_job.repository.js')).generationJobRepository;
const { seriesCastService } = await import('../../services/series_cast.service.js');
const { seriesAuditService } = await import('../../services/series_audit.service.js');
const { parseWeekAudit, buildWeekAuditPrompt } = await import('../../services/helpers/week_audit.helper.js');

const stored = (day, text, extra = {}) => ({ id: `s${day}`, day_order: day, title: `J${day}`, content: `<p>${text}</p>`, summary: `Résumé ${day}.`, series_name: 'Les Martin', ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  repo.existingStories.mockResolvedValue([
    stored(1, 'Léo, 6 ans, joue avec Antonin.'),
    stored(2, 'Léo rit.'),
    stored(3, 'Une autre série.', { series_name: 'Autre' })
  ]);
});

describe('week audit', () => {
  it('reads the AI answer, wrapped or not, and drops issues on other days', () => {
    const audit = parseWeekAudit('```json\n{"issues":[{"day":"Lundi","character":"Léo","type":"age","quote":"6 ans","explanation":"Léo a 5 ans","severity":"high"},{"day":"Jeudi","explanation":"x"}],"recap":"Léo a vu un volcan.","new_facts":["Ils ont un chat"]}\n```', ['Lundi', 'Mardi']);
    expect(audit).toEqual({
      issues: [{ day: 'Lundi', character: 'Léo', type: 'age', quote: '6 ans', explanation: 'Léo a 5 ans', severity: 'high', source: 'ai' }],
      recap: 'Léo a vu un volcan.',
      newFacts: ['Ils ont un chat']
    });
    expect(parseWeekAudit('pas de json')).toBeNull();
  });

  it('gives the bible and the stories to the AI', () => {
    const prompt = buildWeekAuditPrompt({
      cast: { characters: [{ key: 'leo', name: 'Léo', role: 'main', currentAge: 5 }] }, weekNumber: 3, theme: 'La pluie',
      stories: [{ day: 'Lundi', title: 'T', text: 'Texte du lundi' }]
    });
    expect(prompt).toContain('Léo (principal, 5 ans)');
    expect(prompt).toContain('SEMAINE 3 : sujet « La pluie »');
    expect(prompt).toContain('Texte du lundi');
  });

  it('audits the stories of the series, saves recap, audit and facts, marks the next weeks after a rewrite', async () => {
    geminiService.generateText.mockResolvedValue({ model: 'lite', text: '{"issues":[],"recap":"Semaine calme.","new_facts":["Léo a un vélo rouge"]}' });

    const audit = await seriesAuditService.auditStoredWeek({ castId: 'cast1', ageGroup: '4-6', weekNumber: 5, rewritten: true });

    // Local checks: the age of Léo and the hero of another series (the own names are allowed)
    expect(audit.issues.map(issue => `${issue.type}:${issue.severity}`)).toEqual(['name:high', 'age:high']);
    expect(audit).toMatchObject({ status: 'done', recap: 'Semaine calme.', newFacts: ['Léo a un vélo rouge'], stale: 2 });
    // Only the stories of the series are read
    expect(geminiService.generateText.mock.calls[0][1]).not.toContain('Une autre série');
    expect(seriesCastService.saveRecap).toHaveBeenCalledWith('cast1', '4-6', 5, expect.objectContaining({
      recap: 'Semaine calme.', audit: expect.objectContaining({ status: 'done', storyIds: ['s1', 's2'], castVersion: 2 })
    }));
    expect(seriesCastService.replaceProposedFacts).toHaveBeenCalledWith('cast1', '4-6', 5, ['Léo a un vélo rouge']);
  });

  it('keeps the local audit without AI, and a postponed one when the quota is out', async () => {
    expect(await seriesAuditService.auditStoredWeek({ castId: 'cast1', ageGroup: '4-6', weekNumber: 5, useAI: false }))
      .toMatchObject({ status: 'local', recap: 'Résumé 1. Résumé 2.' });
    expect(geminiService.generateText).not.toHaveBeenCalled();

    const quota = Object.assign(new Error('no quota left today'), { postpone: true });
    await expect(seriesAuditService.auditStoredWeek({ castId: 'cast1', ageGroup: '4-6', weekNumber: 5, beforeRequest: async () => { throw quota; } }))
      .rejects.toThrow('no quota');
    expect(seriesCastService.saveRecap.mock.calls.at(-1)[3].audit).toMatchObject({ status: 'postponed', note: 'no quota left today' });
  });
});
