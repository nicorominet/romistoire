// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ALL_WEEK } from '../../services/helpers/prompt.helper.js';
import {
  buildDayParams, countWords, emptyWeekContext, GENERATION_MIN_INTERVAL_MS, isIterativeGeneration, isShortStory,
  missingWeekStories, pacingDelay, paragraphsToHtml, requestsPerUnit, storyEnding, storyOpening
} from '../../services/helpers/generation_plan.helper.js';
import { monthOfWeek, parseTopicSuggestions, buildTopicSuggestionPrompt } from '../../services/helpers/topic_suggestion.helper.js';

describe('generation plan', () => {
  it('generates a week in one request for the youngest ages, day by day from 7-9 or with Ollama', () => {
    expect(isIterativeGeneration(ALL_WEEK, '2-3', 'gemini')).toBe(false);
    expect(isIterativeGeneration(ALL_WEEK, '4-6', 'gemini')).toBe(false);
    expect(isIterativeGeneration(ALL_WEEK, '7-9 ans', 'gemini')).toBe(true);
    expect(requestsPerUnit(ALL_WEEK, '7-9', 'gemini')).toBe(7);
    expect(isIterativeGeneration(ALL_WEEK, '10-12', 'gemini')).toBe(true);
    expect(isIterativeGeneration(ALL_WEEK, '4-6', 'local')).toBe(true);
    expect(isIterativeGeneration('Lundi', '16-18', 'gemini')).toBe(false);
    expect(requestsPerUnit(ALL_WEEK, '16-18', 'gemini')).toBe(7);
    expect(requestsPerUnit(ALL_WEEK, '4-6', 'gemini')).toBe(1);
  });

  it('spaces cloud requests by the minimal interval, counted from the previous start', () => {
    expect(pacingDelay(null, 5000)).toBe(0);
    expect(pacingDelay(1000, 4000)).toBe(GENERATION_MIN_INTERVAL_MS - 3000);
    expect(pacingDelay(1000, 1000 + 60000)).toBe(0);
  });

  it('counts words without HTML and flags stories under 75 % of the minimum', () => {
    expect(countWords('<p>Il était</p><p>une fois</p>')).toBe(4);
    expect(isShortStory(630, { min: 900, max: 1100 })).toBe(true); // 70 %: the usual shortfall
    expect(isShortStory(700, { min: 900, max: 1100 })).toBe(false);
    expect(isShortStory(10, undefined)).toBe(false);
  });

  it('counts the stories missing from a week generated in one request', () => {
    expect(missingWeekStories(ALL_WEEK, 1)).toBe(6);
    expect(missingWeekStories(ALL_WEEK, 7)).toBe(0);
    expect(missingWeekStories('Lundi', 1)).toBe(0);
  });

  it('turns paragraphs into escaped editor HTML', () => {
    expect(paragraphsToHtml(['Léo & Mia', '<b>'])).toBe('<p>Léo &amp; Mia</p><p>&lt;b&gt;</p>');
  });
});

describe('week context', () => {
  it('takes the last paragraph and the first sentence of a story as plain text', () => {
    expect(storyEnding('<p>Début.</p><p>Il pose le pied sur la planche &amp; elle craque !</p>'))
      .toBe('Il pose le pied sur la planche & elle craque !');
    expect(storyEnding('Premier.\n\nDernier.')).toBe('Dernier.');
    expect(storyOpening('<p>Alors que la neige tombait, Claudine sourit. Puis elle sortit.</p>'))
      .toBe('Alors que la neige tombait, Claudine sourit.');
    expect(storyOpening('<p>« Regarde ! » cria Léo en courant.</p>')).toBe('« Regarde ! » cria Léo en courant.');
  });

  it('gives each day the plan, the days told and the last scene', () => {
    const context = emptyWeekContext();
    expect(buildDayParams(context)).toEqual({
      weekSeries: true, weekPlan: undefined, characters: undefined, previousDays: [], previousEnding: undefined, previousSummary: undefined,
    });

    context.weekPlan = ['1', '2'];
    context.days.push({ day: 'Lundi', title: 'La carte', summary: 'Léo trouve une carte.', ending: 'Elle brille !', opening: 'Léo court.' });
    context.days.push({ day: 'Mardi', title: 'Le lac', summary: 'Le pont est cassé.', ending: 'La planche craque !' });

    expect(buildDayParams(context)).toMatchObject({
      weekPlan: ['1', '2'],
      previousDays: [
        { day: 'Lundi', title: 'La carte', summary: 'Léo trouve une carte.', opening: 'Léo court.' },
        { day: 'Mardi', title: 'Le lac', summary: 'Le pont est cassé.' },
      ],
      previousEnding: 'La planche craque !',
    });
  });
});

describe('topic suggestions', () => {
  it('gives the month of a week as a season hint', () => {
    expect(monthOfWeek(1, 2026)).toBe('janvier');
    expect(monthOfWeek(30, 2026)).toBe('juillet');
    expect(monthOfWeek(52, 2026)).toBe('décembre');
  });

  it('asks for the weeks and lists the topics to avoid', () => {
    const prompt = buildTopicSuggestionPrompt([5], [{ week_number: 1, theme_name: 'Les volcans' }]);
    expect(prompt).toContain('semaine 5 (janvier)');
    expect(prompt).toContain('Les volcans');
  });

  it('reads a fenced JSON answer and keeps one suggestion per asked week', () => {
    const text = 'Voici :\n```json\n[{"week": 5, "name": " Les étoiles ", "description": "Observer le ciel."},' +
      '{"week": 5, "name": "Doublon"}, {"week": 9, "name": "Hors liste"}, {"week": 6, "name": ""}, {"week": 4, "name": "Neige"}]\n```';
    expect(parseTopicSuggestions(text, [4, 5, 6])).toEqual([
      { week: 4, name: 'Neige', description: '' },
      { week: 5, name: 'Les étoiles', description: 'Observer le ciel.' },
    ]);
    expect(parseTopicSuggestions('pas de JSON', [1])).toEqual([]);
  });
});
