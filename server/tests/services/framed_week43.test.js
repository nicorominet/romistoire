// @vitest-environment node
// Fixes found by the first real framed run (week 43, October 2026): ages, a false wrong-age, the answer kept,
// the recited sheet and the audit false positives.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));

const { isBetterAnswer } = await import('../../services/story.service.js');
const { detectCastDefects, frenchNumber, recurringUnknownNames } = await import('../../services/helpers/cast_check.helper.js');
const { castForWeek, isoWeekOf, normalizeCast, validateCast } = await import('../../services/helpers/cast_validation.helper.js');
const { PromptHelper } = await import('../../services/helpers/prompt.helper.js');

const NOW = new Date(Date.UTC(2026, 9, 11)); // week 41

describe('ages of the bible', () => {
  it('takes the ages as typed now when no reference week is given', () => {
    expect(isoWeekOf(NOW)).toBe(41);
    expect(normalizeCast({ characters: [] }, NOW).referenceWeek).toBe(41);
  });

  it('tells the right age in week 43 (Léonie 3, birthday on November 4)', () => {
    const cast = normalizeCast({ characters: [{ name: 'Léonie', age: 3, birthday: '11-04' }] }, NOW);
    expect(castForWeek(cast, 43, NOW).characters[0].currentAge).toBe(3);
    expect(castForWeek(cast, 46, NOW).characters[0].currentAge).toBe(4);
  });

  it('gives the age turned for a birthday after the Thursday', () => {
    // Week 45 of 2026: Monday November 2 to Sunday November 8; Saturday November 7 is after its Thursday
    const cast = normalizeCast({ referenceWeek: 41, characters: [{ name: 'Léo', age: 3, birthday: '11-07' }] }, NOW);
    expect(castForWeek(cast, 45, NOW).characters[0]).toMatchObject({ currentAge: 3, birthdayThisWeek: true, birthdayAge: 4 });
    const section = PromptHelper.getCastSection(castForWeek(cast, 45, NOW));
    expect(section).toContain('fête ses 4 ans');
  });

  it('warns about a name of the universe that is not a character', () => {
    const cast = normalizeCast({
      name: 'X', ageGroups: ['2-3'], universe: 'Une maison à Lille. Il y a aussi le chat femelle Sweety, et la Toussaint arrive.',
      characters: [{ name: 'Léonie', age: 3, visual: 'v' }]
    }, NOW);
    expect(validateCast(cast, { now: NOW }).warnings).toEqual([{ code: 'universe-character', detail: 'Sweety' }]);
  });
});

describe('age check of the stories', () => {
  const cast = { characters: [{ name: 'Marion', role: 'recurring', currentAge: 43 }, { name: 'Léonie', role: 'main', currentAge: 3 }] };

  it('reads compound numbers whole', () => {
    expect(frenchNumber('quarante-trois')).toBe(43);
    expect(frenchNumber('vingt et un')).toBe(21);
    expect(frenchNumber('soixante-dix-sept')).toBe(77);
    expect(frenchNumber('quatre-vingt-dix')).toBe(90);
    expect(frenchNumber('dix-huit')).toBe(18);
    expect(frenchNumber('maman')).toBeNull();
  });

  it('does not read "quarante-trois ans" as "trois ans"', () => {
    const story = { day: 'Lundi', paragraphs: ['Marion, la maman de quarante-trois ans aux cheveux bruns, sourit à Léonie.'] };
    expect(detectCastDefects([story], cast)).toEqual([]);
    const wrong = { day: 'Lundi', paragraphs: ['Marion, la maman de quarante-deux ans, sourit à Léonie.'] };
    expect(detectCastDefects([wrong], cast)).toMatchObject([{ code: 'wrong-age', detail: 'Marion 42/43' }]);
  });
});

describe('answer kept after a second try', () => {
  const target = { min: 300, max: 450 };
  const answer = (words, defects = []) => ({ words, defects });
  const wrongAge = { code: 'wrong-age', blocking: true };
  const cjk = { code: 'cjk', blocking: true };

  it('keeps a long answer with a bible defect over a short one without', () => {
    const first = answer([331, 320, 316, 310, 305, 300, 316], [wrongAge]);
    const retry = answer([248, 210, 196, 205, 180, 188, 205]);
    expect(isBetterAnswer(retry, first, 7, target)).toBe(false);
  });

  it('still prefers the answer without bible defect when both have the length', () => {
    expect(isBetterAnswer(answer([320]), answer([340], [wrongAge]), 1, target)).toBe(true);
  });

  it('keeps the free-generation order: a generation slip outweighs the length', () => {
    expect(isBetterAnswer(answer([200]), answer([340], [cjk]), 1, target)).toBe(true);
    expect(isBetterAnswer(answer([200]), answer([340]), 1, target)).toBe(false);
  });
});

describe('prompt and audit', () => {
  it('forbids reciting the sheet in the text', () => {
    const section = PromptHelper.getCastSection({ characters: [{ key: 'm', name: 'Marion', role: 'recurring', currentAge: 43 }] });
    expect(section).toContain("ne récitez jamais la fiche : on ne dit pas l'âge des adultes");
  });

  it('does not report the cat of the universe nor the feasts as new characters', () => {
    const cast = { universe: 'Une famille et le chat femelle Sweety.', characters: [{ name: 'Léonie' }] };
    const texts = ['Léonie joue avec Sweety pour la Toussaint.', 'Ce matin, Sweety dort. Bientôt la Toussaint.', 'Léonie et Sweety rient, vive la Toussaint.'];
    expect(recurringUnknownNames(texts, cast)).toEqual([]);
    expect(recurringUnknownNames(texts, { characters: [{ name: 'Léonie' }] })).toEqual([{ name: 'Sweety', days: 3 }]);
  });
});

describe('run 2 of week 43 (11 Oct.): length, scripts, looks, facts', () => {
  it('keeps the long retry over a week far too short, even with one day over the limit', () => {
    const target = { min: 300, max: 450 };
    const short = { words: [179, 182, 171, 168, 165, 181, 157], defects: [] };
    const long = { words: [589, 572, 562, 562, 531, 534, 535], defects: [{ code: 'too-long', blocking: true }] };
    expect(isBetterAnswer(long, short, 7, target)).toBe(true);
    // One answer only has a length problem: as before
    expect(isBetterAnswer({ words: [640], defects: [{ code: 'too-long', blocking: true }] }, { words: [350], defects: [] }, 1, target)).toBe(false);
  });
});
