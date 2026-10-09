import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/gemini.service.js', () => ({ geminiService: { apiKey: 'key', generateText: vi.fn() } }));
vi.mock('../../services/local_llm.service.js', () => ({ localLLMService: { generateText: vi.fn() } }));

const db = await import('../../config/database.js');
const { geminiService } = await import('../../services/gemini.service.js');
const { illustrationService } = await import('../../services/illustration.service.js');
const { ValidationError, NotFoundError } = await import('../../middleware/error.middleware.js');
const { imageCode, buildImagePrompt, cleanIllustrationPrompt, buildPromptsText, buildIllustrationRequest } = await import('../../services/helpers/image_prompt.helper.js');

const row = (id, week, day, prompt = 'Un hérisson sous la pluie.') => ({
  id, title: `Histoire ${day}`, week_number: week, day_order: day, age_group: '4-6', series_id: 's1',
  illustration_prompt: prompt, illustration_count: 0, cover: null
});

describe('image prompts', () => {
  it('should give a short code taken from the story id', () => {
    expect(imageCode('7f3a2c91-1234-4abc-8def-000000000000')).toBe('IMG-7f3a2c91');
  });

  it('should add the style of the age group and the "no text" rule', () => {
    const young = buildImagePrompt({ age_group: '4-6', illustration_prompt: 'Un hérisson.' });
    expect(young).toContain('aquarelle');
    expect(young).toContain('Un hérisson.');
    expect(young).toContain('Aucun texte');
    expect(buildImagePrompt({ age_group: '10-12', illustration_prompt: 'x' })).toContain('album illustré');
    expect(buildImagePrompt({ age_group: '16-18', illustration_prompt: 'x' })).toContain('semi-réaliste');
    expect(buildImagePrompt({ age_group: '4-6', illustration_prompt: '  ' })).toBe('');
  });

  it('should clean the description written by the AI', () => {
    expect(cleanIllustrationPrompt('**Illustration :** « Un renard  roux dans la neige. »')).toBe('Un renard roux dans la neige.');
  });

  it('should send the story as plain text', () => {
    const request = buildIllustrationRequest({ title: 'Le renard', age_group: '4-6', content: "<p>Il était une fois l&#39;hiver.</p><p>[Illustration: x] Fin.</p>" });
    expect(request).toBe("Titre : Le renard\nPublic : 4-6 ans\n\nIl était une fois l'hiver.\n Fin.");
  });

  it('should group the text file by week and flag the stories without prompt', () => {
    const items = [
      { ...row('aaaaaaaa-1', 41, 1), code: 'IMG-aaaaaaaa', imagePrompt: 'P1' },
      { ...row('bbbbbbbb-1', 42, 2, null), code: 'IMG-bbbbbbbb', imagePrompt: '' }
    ];
    const text = buildPromptsText(items);
    expect(text).toContain('Semaine 41 · 4-6 ans');
    expect(text).toContain('Semaine 42 · 4-6 ans');
    expect(text).toContain('IMG-aaaaaaaa · Lundi — Histoire 1\nP1');
    expect(text).toContain('IMG-bbbbbbbb · Mardi — Histoire 2\n(prompt à créer');
  });
});

describe('IllustrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue([]);
  });

  it('should list the stories without image by default, in book order', async () => {
    db.query.mockResolvedValue([row('aaaaaaaa-1', 42, 1)]);

    const [item] = await illustrationService.findTodo({ weekNumber: '42' });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM illustrations');
    expect(sql).toContain('ORDER BY s.week_number');
    expect(params).toEqual(['fr', '42']);
    expect(item).toMatchObject({ code: 'IMG-aaaaaaaa', illustrationCount: 0, day_order: 1 });
    expect(item.imagePrompt).toContain('Un hérisson sous la pluie.');
  });

  it('should export the JSON of the Canvas tool, without the stories that have no prompt', async () => {
    db.query.mockResolvedValue([row('aaaaaaaa-1', 42, 1), row('bbbbbbbb-1', 42, 2, null)]);

    const { body, filename } = await illustrationService.exportPrompts({}, 'json');

    expect(filename).toMatch(/\.json$/);
    const data = JSON.parse(body);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ code: 'IMG-aaaaaaaa', title: 'Histoire 1', week: 42, day: 'Lundi', age: '4-6' });
    expect(data[0].prompt).toContain('Aucun texte');
  });

  it('should save the description written by the AI without a new story version', async () => {
    db.query.mockResolvedValueOnce([{ id: 'a', title: 'Le renard', content: '<p>Texte</p>', age_group: '4-6' }]);
    geminiService.generateText.mockResolvedValue({ text: '"Un renard roux dans la neige."', model: 'm' });

    const result = await illustrationService.generatePrompt('a');

    expect(result.illustration_prompt).toBe('Un renard roux dans la neige.');
    expect(result.imagePrompt).toContain('aquarelle');
    const [sql, params] = db.query.mock.calls[1];
    expect(sql).toBe('UPDATE stories SET illustration_prompt = ? WHERE id = ?');
    expect(params).toEqual(['Un renard roux dans la neige.', 'a']);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('should validate the manual description', async () => {
    await expect(illustrationService.setPrompt('a', '  ')).rejects.toBeInstanceOf(ValidationError);
    await expect(illustrationService.setPrompt('a', 'x'.repeat(2001))).rejects.toBeInstanceOf(ValidationError);
    await expect(illustrationService.setPrompt('missing', 'Un renard')).rejects.toBeInstanceOf(NotFoundError);
  });
});
