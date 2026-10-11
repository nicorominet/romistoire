// @vitest-environment node
// Framed series: the look of the characters goes to the AI prompts (story, illustration, image), not into the story.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/gemini.service.js', () => ({ geminiService: { apiKey: 'key', generateText: vi.fn() } }));
vi.mock('../../services/local_llm.service.js', () => ({ localLLMService: { generateText: vi.fn() } }));

const db = await import('../../config/database.js');
const { geminiService } = await import('../../services/gemini.service.js');
const { illustrationService } = await import('../../services/illustration.service.js');
const { castLookBlock, characterLook } = await import('../../services/helpers/cast_look.helper.js');
const { buildImagePrompt, buildIllustrationRequest } = await import('../../services/helpers/image_prompt.helper.js');
const { PromptHelper } = await import('../../services/helpers/prompt.helper.js');

const leonie = {
  key: 'leonie', name: 'Léonie', role: 'main', gender: 'féminin', age: 3, currentAge: 3,
  physical: { hair: 'dorés', eyes: 'bleus', build: '', clothing: 'robe rose', distinctive: '' },
  visual: 'petite fille aux boucles dorées', personality: 'curieuse', speech: '', relations: [{ to: 'marion', type: 'child' }]
};
const marion = {
  key: 'marion', name: 'Marion', role: 'recurring', gender: 'féminin', age: 43, currentAge: 43,
  physical: { hair: 'bruns', eyes: 'verts', build: '', clothing: 'robe élégante', distinctive: '' }, visual: '', relations: []
};
const cast = { characters: [leonie, marion] };

describe('look of the characters', () => {
  it('writes one fixed line per character', () => {
    expect(characterLook(leonie)).toBe('Léonie (féminin, 3 ans) : petite fille aux boucles dorées ; cheveux dorés, yeux bleus, tenue : robe rose');
    expect(characterLook({ name: 'Sweety', species: 'chat' })).toBe('Sweety (chat)');
  });

  it('shows in a picture the characters it names, else the main ones', () => {
    expect(castLookBlock(cast, 'Marion lit un livre.')).toBe('Personnages (apparence fixe à respecter) :\n- Marion (féminin, 43 ans) : cheveux bruns, yeux verts, tenue : robe élégante');
    expect(castLookBlock(cast, 'Un hérisson dans le jardin.')).toContain('- Léonie (féminin, 3 ans)');
    expect(castLookBlock(cast, 'Un hérisson.')).not.toContain('Marion');
    expect(castLookBlock(null, 'x')).toBe('');
  });
});

describe('story prompt', () => {
  it('keeps the looks apart, for the illustrations only', () => {
    const section = PromptHelper.getCastSection(cast);
    const [story, looks] = section.split('Apparence (pour les illustrations uniquement');
    expect(story).toContain('Léonie (personnage principal, féminin, 3 ans). Caractère : curieuse');
    expect(story).not.toContain('robe');
    expect(looks).toContain('ne la décrivez pas dans le récit');
    expect(looks).toContain('Marion (féminin, 43 ans) : cheveux bruns, yeux verts, tenue : robe élégante');
  });
});

describe('image prompts of a framed story', () => {
  it('adds the bible to the prompt pasted into the image tool, nothing without bible', () => {
    const prompt = buildImagePrompt({ age_group: '2-3', illustration_prompt: 'Léonie saute dans les feuilles.' }, cast);
    expect(prompt).toContain('Léonie saute dans les feuilles.\n\nPersonnages (apparence fixe à respecter) :\n- Léonie');
    expect(prompt.indexOf('Personnages')).toBeLessThan(prompt.indexOf('Aucun texte'));
    expect(buildImagePrompt({ age_group: '2-3', illustration_prompt: 'x' })).not.toContain('Personnages');
  });

  it('gives the looks to the AI that describes the illustration', () => {
    const request = buildIllustrationRequest({ title: 'T', age_group: '2-3', content: '<p>Léonie joue.</p>' }, cast);
    expect(request).toContain('Apparence des personnages (décrivez exactement ainsi ceux qui sont dans la scène) :\n- Léonie');
    expect(buildIllustrationRequest({ title: 'T', content: '<p>x</p>' })).not.toContain('Apparence');
  });
});

describe('illustration service', () => {
  const castRow = {
    id: 'c1', series_id: 's1', name: 'Famille', age_groups: '["2-3"]', universe: '', rules: '[]', reference_week: 41, version: 1,
    characters: JSON.stringify([{ ...leonie, birthday: '11-04', currentAge: undefined }])
  };
  beforeEach(() => vi.clearAllMocks());

  it('attaches the bible of its series and age group to each image prompt, with the age of its week', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM series_casts')) return [castRow];
      return [
        { id: 'a', title: 'A', week_number: 43, day_order: 1, age_group: '2-3', series_id: 's1', illustration_prompt: 'Léonie rit.' },
        { id: 'b', title: 'B', week_number: 43, day_order: 1, age_group: '4-6', series_id: 's1', illustration_prompt: 'Léonie rit.' },
        { id: 'c', title: 'C', week_number: 43, day_order: 1, age_group: '2-3', series_id: null, illustration_prompt: 'Léonie rit.' }
      ];
    });
    const [framed, otherAge, free] = await illustrationService.findTodo({});
    expect(framed.imagePrompt).toContain('- Léonie (féminin, 3 ans)');
    expect(otherAge.imagePrompt).not.toContain('Personnages');
    expect(free.imagePrompt).not.toContain('Personnages');
    // One query for the casts of the whole list
    expect(db.query.mock.calls.filter(([sql]) => sql.includes('FROM series_casts'))).toHaveLength(1);
  });

  it('writes the description of a framed story with the looks of its bible', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM series_casts')) return [castRow];
      if (sql.startsWith('SELECT id, title')) return [{ id: 'a', title: 'A', content: '<p>Léonie rit.</p>', age_group: '2-3', series_id: 's1', week_number: 43 }];
      return { affectedRows: 1 };
    });
    geminiService.generateText.mockResolvedValue({ text: 'Léonie, petite fille aux boucles dorées, rit.' });

    const result = await illustrationService.generatePrompt('a');
    expect(geminiService.generateText.mock.calls[0][1]).toContain('Apparence des personnages');
    expect(result.imagePrompt).toContain('Personnages (apparence fixe à respecter)');
  });
});
