import { describe, it, expect } from 'vitest';
import { extractJson, parseStoryOutput } from '../../services/helpers/story_output.helper.js';

const story = (overrides = {}) => ({
  day: 'Lundi',
  title: 'La goutte',
  summary: 'Léa suit une goutte.',
  themes: [{ name: 'Nature', description: "Le cycle de l'eau", icon: '💧', color: '#2196F3' }],
  paragraphs: ['Premier.', 'Second.'],
  illustration_prompt: 'Une fille en ciré jaune.',
  ...overrides
});

describe('extractJson', () => {
  it('should ignore code fences and chatter around the JSON', () => {
    const text = 'Voici l\'histoire :\n```json\n{"stories":[{"title":"A } b"}]}\n```\nBonne lecture !';
    expect(JSON.parse(extractJson(text))).toEqual({ stories: [{ title: 'A } b' }] });
  });

  it('should return null for unbalanced JSON', () => {
    expect(extractJson('{"stories": [')).toBeNull();
    expect(extractJson('pas de json')).toBeNull();
  });
});

describe('parseStoryOutput', () => {
  it('should normalize a clean answer', () => {
    const [parsed] = parseStoryOutput(JSON.stringify({ stories: [story()] }));

    expect(parsed).toEqual({
      day: 'Lundi',
      title: 'La goutte',
      summary: 'Léa suit une goutte.',
      themes: [{ name: 'Nature', description: "Le cycle de l'eau", icon: '💧', color: '#2196F3' }],
      paragraphs: ['Premier.', 'Second.'],
      illustrationPrompt: 'Une fille en ciré jaune.'
    });
  });

  it('should accept a single object, a bare array or a story without wrapper', () => {
    expect(parseStoryOutput(JSON.stringify({ stories: story() }))).toHaveLength(1);
    expect(parseStoryOutput(JSON.stringify([story(), story({ day: 'Mardi' })]))).toHaveLength(2);
    expect(parseStoryOutput(JSON.stringify(story()))).toHaveLength(1);
  });

  it('should normalize day names written in lowercase or with punctuation', () => {
    const stories = parseStoryOutput(JSON.stringify({ stories: [story({ day: 'mercredi.' }), story({ day: 'Jour inconnu' })] }));
    expect(stories.map(s => s.day)).toEqual(['Mercredi', null]);
  });

  it('should split a "content" string into paragraphs when "paragraphs" is missing', () => {
    const [parsed] = parseStoryOutput(JSON.stringify({ stories: [story({ paragraphs: undefined, content: 'Un.\n\nDeux.' })] }));
    expect(parsed.paragraphs).toEqual(['Un.', 'Deux.']);
  });

  it('should drop invalid themes and colors, and empty stories', () => {
    const stories = parseStoryOutput(JSON.stringify({ stories: [
      story({ themes: [{ name: '' }, { name: 'Amitié', color: 'rouge' }] }),
      story({ paragraphs: [] })
    ] }));

    expect(stories).toHaveLength(1);
    expect(stories[0].themes).toEqual([{ name: 'Amitié', description: '', icon: '', color: undefined }]);
  });

  it('should return null when the answer is not JSON', () => {
    expect(parseStoryOutput('**Titre de l\'Histoire :** La pluie\n\nIl pleut.')).toBeNull();
    expect(parseStoryOutput('{"stories": []}')).toBeNull();
  });
});
