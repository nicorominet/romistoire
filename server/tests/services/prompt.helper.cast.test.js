// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PromptHelper, ALL_WEEK } from '../../services/helpers/prompt.helper.js';
import { castForWeek, normalizeCast } from '../../services/helpers/cast_validation.helper.js';
import { geminiResponseSchema } from '../../services/helpers/story_schema.js';

const NOW = new Date(Date.UTC(2026, 9, 11));
const cast = castForWeek(normalizeCast({
  name: 'Famille Martin', ageGroups: ['4-6'], universe: 'Un village au bord de la mer.', rules: ['Pas de magie'],
  characters: [
    { name: 'Léo', role: 'main', age: 5, birthday: '03-15', physical: { hair: 'bruns bouclés', clothing: 'salopette verte' }, visual: 'garçon, boucles brunes, salopette verte', relations: [{ to: 'Papa', type: 'child' }] },
    { name: 'Papa', role: 'recurring', age: 38, visual: 'grand, barbe rousse' }
  ]
}), 11, NOW);

const base = { theme: 'Les volcans', age: '4-6', weekNumber: 11, seriesName: 'Les Martin' };

describe('framed prompt (series bible)', () => {
  it('tells the cast of the week: ages, look, ties, rules, facts and recaps', () => {
    const section = PromptHelper.getCastSection(cast, {
      seriesName: 'Les Martin',
      facts: [{ weekNumber: 3, text: 'Ils ont adopté un chat, Pompon.' }],
      recaps: [{ weekNumber: 10, recap: 'Léo a planté des graines.' }]
    });
    expect(section).toContain('BIBLE DE LA SÉRIE « Les Martin »');
    expect(section).toContain('Léo (personnage principal, 6 ans)');
    expect(section).toContain('cheveux bruns bouclés');
    expect(section).toContain('enfant de Papa');
    expect(section).toContain('parent de Léo');
    expect(section).toContain('fête ses 6 ans');
    expect(section).toContain('Pas de magie');
    expect(section).toContain('Ils ont adopté un chat, Pompon.');
    expect(section).toContain('Semaine 10 : Léo a planté des graines.');
  });

  it('replaces the free character settings and never asks the AI for a sheet', () => {
    const prompt = PromptHelper.buildStoryPrompt({ ...base, day: 'Lundi', weekSeries: true, cast, numCharacters: 4, charNames: 'Zoé' });
    expect(prompt).toContain('BIBLE DE LA SÉRIE');
    expect(prompt).not.toContain('Noms des personnages principaux');
    expect(prompt).not.toContain('"characters"');
    expect(prompt).toContain('"week_plan"');
    expect(PromptHelper.wantsCharacters({ day: ALL_WEEK, cast })).toBe(false);
    expect(PromptHelper.wantsWeekPlan({ day: 'Lundi', weekSeries: true, cast })).toBe(true);
  });

  it('keeps the free prompt as it was', () => {
    const prompt = PromptHelper.buildStoryPrompt({ ...base, day: ALL_WEEK, charNames: 'Zoé' });
    expect(prompt).not.toContain('BIBLE');
    expect(prompt).toContain('Noms des personnages principaux : Zoé.');
    expect(PromptHelper.wantsCharacters({ day: ALL_WEEK })).toBe(true);
  });

  it('asks for the plan without the character sheet in the schema', () => {
    const framed = geminiResponseSchema({ withWeekPlan: true, withCharacters: false });
    expect(framed.required).toEqual(['week_plan', 'stories']);
    expect(geminiResponseSchema({ withWeekPlan: true }).required).toEqual(['week_plan', 'characters', 'stories']);
  });
});
