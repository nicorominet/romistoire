// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ageAtWeek, birthdayInWeek, nameKey, normalizeCast, validateCast } from '../../services/helpers/cast_validation.helper.js';

/** October 11, 2026 (week 41): weeks 1 to 32 belong to 2027 (yearOfWeek). */
const NOW = new Date(Date.UTC(2026, 9, 11));

const family = (overrides = {}) => normalizeCast({
  name: 'Famille Martin',
  ageGroups: ['4-6'],
  characters: [
    { name: 'Léo', role: 'main', age: 5, physical: { hair: 'cheveux bruns bouclés' }, relations: [{ to: 'Mia', type: 'sibling' }] },
    { name: 'Mia', role: 'main', age: 7, visual: 'fillette, tresses rousses, ciré jaune' },
    { name: 'Papa', role: 'recurring', age: 38, visual: 'grand, barbe', relations: [{ to: 'Léo', type: 'parent' }] }
  ],
  ...overrides
});

const codes = (issues) => issues.map(issue => issue.code);

describe('normalizeCast', () => {
  it('gives each character a unique key and completes the ties both ways', () => {
    const cast = family();
    const [leo, mia, papa] = cast.characters;
    expect(leo.key).toBe('leo');
    expect(mia.relations).toEqual([{ to: 'leo', type: 'sibling' }]);
    expect(leo.relations).toContainEqual({ to: 'papa', type: 'child' });
    expect(papa.relations).toEqual([{ to: 'leo', type: 'parent' }]);
  });

  it('keeps two characters of the same name apart', () => {
    const cast = normalizeCast({ characters: [{ name: 'Léo' }, { name: 'Leo' }] });
    expect(cast.characters.map(c => c.key)).toEqual(['leo', 'leo-2']);
  });

  it('drops unknown age groups, invalid birthdays and roles', () => {
    const cast = normalizeCast({ ageGroups: ['4-6', '99'], characters: [{ name: 'A', birthday: '13-40', role: 'boss' }] });
    expect(cast.ageGroups).toEqual(['4-6']);
    expect(cast.characters[0]).toMatchObject({ birthday: null, role: 'main' });
  });
});

describe('validateCast', () => {
  it('accepts a consistent family', () => {
    const { errors, warnings } = validateCast(family(), { now: NOW });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('refuses a parent barely older than the child', () => {
    const cast = family();
    cast.characters[2].age = 15;
    expect(codes(validateCast(cast, { now: NOW }).errors)).toContain('parent-age');
  });

  it('refuses a name reserved by another series, and duplicate names', () => {
    const cast = normalizeCast({ name: 'X', ageGroups: ['4-6'], characters: [{ name: 'Antonin', age: 5 }, { name: 'antonin', age: 5 }] });
    const errors = codes(validateCast(cast, { reservedNames: ['ANTONIN'], now: NOW }).errors);
    expect(errors).toContain('reserved-name');
    expect(errors).toContain('duplicate-name');
  });

  it('refuses an age group already given to another cast of the series', () => {
    expect(validateCast(family(), { takenAgeGroups: ['4-6'], now: NOW }).errors).toContainEqual({ code: 'age-group-taken', detail: '4-6' });
  });

  it('refuses a tie towards an unknown character', () => {
    const cast = family();
    cast.characters[0].relations.push({ to: 'ghost', type: 'friend' });
    expect(codes(validateCast(cast, { now: NOW }).errors)).toContain('unknown-relation');
  });

  it('warns about a hero too old for the readers, and too many heroes for the little ones', () => {
    const cast = normalizeCast({
      name: 'X', ageGroups: ['2-3'],
      characters: [{ name: 'A', age: 12, visual: 'v' }, { name: 'B', age: 3, visual: 'v' }, { name: 'C', age: 3, visual: 'v' }]
    });
    const warnings = codes(validateCast(cast, { now: NOW }).warnings);
    expect(warnings).toContain('hero-age-range');
    expect(warnings).toContain('too-many-main');
  });

  it('does not check the age of an animal hero', () => {
    const cast = normalizeCast({ name: 'X', ageGroups: ['4-6'], characters: [{ name: 'Hibou', species: 'hibou', age: 80, visual: 'v' }] });
    expect(validateCast(cast, { now: NOW }).warnings).toEqual([]);
  });
});

describe('ageAtWeek / birthdayInWeek', () => {
  const hero = { age: 5, birthday: '03-15' };

  it('adds the birthdays passed since the reference week', () => {
    expect(ageAtWeek(hero, 1, 1, NOW)).toBe(5);
    expect(ageAtWeek(hero, 10, 1, NOW)).toBe(5); // March 11, 2027
    expect(ageAtWeek(hero, 12, 1, NOW)).toBe(6); // March 25, 2027
  });

  it('counts back before the reference week (weeks of the end of 2026)', () => {
    expect(ageAtWeek(hero, 45, 12, NOW)).toBe(4);
  });

  it('keeps the age without birthday', () => {
    expect(ageAtWeek({ age: 5 }, 30, 1, NOW)).toBe(5);
    expect(ageAtWeek({ age: null }, 30, 1, NOW)).toBeNull();
  });

  it('finds the week of the birthday', () => {
    expect(birthdayInWeek(hero, 11, NOW)).toBe(true); // March 15-21, 2027
    expect(birthdayInWeek(hero, 12, NOW)).toBe(false);
  });

  it('compares names without case or accents', () => {
    expect(nameKey(' Léo-Paul ')).toBe('leo paul');
  });
});
