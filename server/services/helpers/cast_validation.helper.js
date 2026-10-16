import { PromptHelper } from './prompt.helper.js';
import { CALENDAR_WORDS } from './cast_check.helper.js';
import { AGE_GROUPS } from '../../../shared/ageGroups.js';

/** Name compared without case, accents or punctuation ("Léo" = "leo"). */
export const nameKey = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Bible of a framed series: its cast (one per set of age groups) is cleaned and checked before any generation,
 * so the stories follow a sheet that holds together (ages of a family, ties both ways, heroes of the right age).
 */

export const CAST_AGE_GROUPS = AGE_GROUPS;
/** Ages of the readers of each group: a human hero is about their age. */
const READER_AGES = { '2-3': [2, 3], '4-6': [4, 6], '7-9': [7, 9], '10-12': [10, 12], '13-15': [13, 15], '16-18': [16, 18] };
/** A hero may be a little younger or older than the readers (they like heroes slightly older). */
const HERO_AGE_MARGIN = { below: 1, above: 3 };
/** Main characters a young reader can follow. */
const MAX_MAIN = { '2-3': 2, '4-6': 3 };
const DEFAULT_MAX_MAIN = 5;
export const MAX_CHARACTERS = 12;
/** Smallest age gap between a parent and a child, between a grandparent and a parent. */
const MIN_PARENT_GAP = 16;

const ROLES = ['main', 'recurring'];
/** Words before a place name ("à Lille", "en Bretagne", "près de Rouen"). */
const PLACE_WORDS = new Set(['à', 'a', 'au', 'aux', 'en', 'de', 'du', 'des', 'dans', 'vers', 'près', 'sur', '']);
/** Tie -> tie seen from the other character. */
export const RELATION_INVERSE = {
  parent: 'child', child: 'parent',
  grandparent: 'grandchild', grandchild: 'grandparent',
  sibling: 'sibling', cousin: 'cousin', friend: 'friend', partner: 'partner',
  pet: 'owner', owner: 'pet',
  other: 'other'
};
export const RELATION_TYPES = Object.keys(RELATION_INVERSE);

const PHYSICAL_FIELDS = ['hair', 'eyes', 'build', 'clothing', 'distinctive'];
const text = (value, max = 300) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isHuman = (character) => !character.species || /^(humaine?|enfant|fille|garçon|personne)$/i.test(character.species);

/** "Léo Martin" -> "leo-martin". */
const slug = (name) => nameKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'perso';

/**
 * Cleans a character as sent by the form.
 * @returns {Object} Same shape, trimmed; age null when unknown; birthday "MM-DD" or null.
 */
const cleanCharacter = (input = {}) => {
  const age = input.age === '' || input.age === null || input.age === undefined ? null : Number(input.age);
  const birthday = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(input.birthday || '')) ? input.birthday : null;
  const physical = {};
  for (const field of PHYSICAL_FIELDS) physical[field] = text(input.physical?.[field], 200);
  return {
    key: text(input.key, 60),
    name: text(input.name, 60),
    role: ROLES.includes(input.role) ? input.role : 'main',
    species: text(input.species, 60),
    gender: text(input.gender, 30),
    age: Number.isFinite(age) ? age : null,
    birthday,
    physical,
    personality: text(input.personality, 400),
    speech: text(input.speech, 200),
    visual: text(input.visual, 500),
    relations: (Array.isArray(input.relations) ? input.relations : [])
      .map(relation => ({ to: text(relation?.to, 60), type: RELATION_TYPES.includes(relation?.type) ? relation.type : 'other' }))
      .filter(relation => relation.to)
  };
};

/**
 * Cleans a whole cast: characters get a unique key, ties are completed both ways.
 * @returns {{name: string, ageGroups: string[], universe: string, rules: string[], referenceWeek: number, characters: Object[]}}
 */
export const normalizeCast = (input = {}, now = new Date()) => {
  const characters = (Array.isArray(input.characters) ? input.characters : []).slice(0, MAX_CHARACTERS).map(cleanCharacter);
  const used = new Set();
  for (const character of characters) {
    let key = character.key || slug(character.name);
    for (let n = 2; used.has(key); n++) key = `${character.key || slug(character.name)}-${n}`;
    character.key = key;
    used.add(key);
  }
  // A tie may name a character by its key or by its name
  const byName = new Map(characters.map(character => [nameKey(character.name), character.key]));
  for (const character of characters) {
    character.relations = character.relations.map(relation => ({
      ...relation, to: used.has(relation.to) ? relation.to : (byName.get(nameKey(relation.to)) || relation.to)
    }));
  }
  // Ties both ways: "Léo parent of Mia" also gives "Mia child of Léo"
  for (const character of characters) {
    for (const relation of character.relations) {
      const other = characters.find(c => c.key === relation.to);
      if (!other || other === character) continue;
      if (!other.relations.some(r => r.to === character.key)) {
        other.relations.push({ to: character.key, type: RELATION_INVERSE[relation.type] });
      }
    }
  }
  // Ages are typed as they are now: the reference is the current week unless given
  const referenceWeek = Number(input.referenceWeek ?? input.reference_week ?? isoWeekOf(now));
  return {
    name: text(input.name, 255),
    ageGroups: CAST_AGE_GROUPS.filter(age => (Array.isArray(input.ageGroups) ? input.ageGroups : []).includes(age)),
    universe: text(input.universe, 3000),
    rules: (Array.isArray(input.rules) ? input.rules : []).map(rule => text(rule, 300)).filter(Boolean).slice(0, 20),
    referenceWeek: Number.isInteger(referenceWeek) && referenceWeek >= 1 && referenceWeek <= 53 ? referenceWeek : isoWeekOf(now),
    characters
  };
};

/** ISO week of a date (the week of its Thursday; week 1 holds January 4th). */
export const isoWeekOf = (date) => {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  return 1 + Math.floor((thursday - week1Monday) / (7 * 86400000));
};

/** Thursday (UTC) of an ISO week: the day that sets its year and month. */
export const weekThursday = (weekNumber, year) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const thursday = new Date(jan4);
  thursday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(weekNumber) - 1) * 7 + 3);
  return thursday;
};

/** Birthdays of "MM-DD" strictly after `from` and up to `to` (dates). */
const birthdaysBetween = (birthday, from, to) => {
  const [month, day] = birthday.split('-').map(Number);
  let count = 0;
  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date > from && date <= to) count++;
  }
  return count;
};

/**
 * Age of a character during a week of the program: its age at the reference week of the cast,
 * plus the birthdays passed since (minus those before it). Weeks belong to the year of the program (yearOfWeek).
 * @returns {number|null}
 */
export const ageAtWeek = (character, weekNumber, referenceWeek = 1, now = new Date(), dayOffset = 0) => {
  if (character?.age === null || character?.age === undefined) return null;
  if (!character.birthday || !weekNumber) return character.age;
  const reference = weekThursday(referenceWeek, PromptHelper.yearOfWeek(referenceWeek, now));
  // dayOffset: days after the Thursday (3: the Sunday, once a birthday of the week has passed)
  const target = weekThursday(weekNumber, PromptHelper.yearOfWeek(weekNumber, now));
  target.setUTCDate(target.getUTCDate() + dayOffset);
  return target >= reference
    ? character.age + birthdaysBetween(character.birthday, reference, target)
    : character.age - birthdaysBetween(character.birthday, target, reference);
};

/** Whether the birthday of a character falls in a week (Monday to Sunday). */
export const birthdayInWeek = (character, weekNumber, now = new Date()) => {
  if (!character?.birthday || !weekNumber) return false;
  const thursday = weekThursday(weekNumber, PromptHelper.yearOfWeek(weekNumber, now));
  const monday = new Date(thursday);
  monday.setUTCDate(thursday.getUTCDate() - 4);
  const sunday = new Date(thursday);
  sunday.setUTCDate(thursday.getUTCDate() + 3);
  return birthdaysBetween(character.birthday, monday, sunday) > 0;
};

/**
 * Cast as told during a week: each character gets its age that week and whether its birthday falls in it.
 * @returns {Object} The cast, characters with `currentAge` (number|null, on the Thursday), `birthdayThisWeek`
 *   (boolean) and `birthdayAge` (the age it turns that week, null without birthday that week).
 */
export const castForWeek = (cast, weekNumber, now = new Date()) => ({
  ...cast,
  characters: (cast?.characters || []).map(character => {
    const birthdayThisWeek = birthdayInWeek(character, weekNumber, now);
    return {
      ...character,
      currentAge: ageAtWeek(character, weekNumber, cast.referenceWeek, now),
      birthdayThisWeek,
      // A birthday on Friday to Sunday is after the Thursday: the age turned is the one of the Sunday
      birthdayAge: birthdayThisWeek ? ageAtWeek(character, weekNumber, cast.referenceWeek, now, 3) : null
    };
  })
});

/**
 * Checks a cleaned cast.
 * @param {Object} cast - From normalizeCast.
 * @param {{reservedNames?: string[], takenAgeGroups?: string[], weeks?: number[], now?: Date}} [options]
 *   reservedNames: heroes of the other series; takenAgeGroups: age groups of the other casts of the series;
 *   weeks: weeks about to be generated (ages computed on them).
 * @returns {{errors: {code: string, character?: string, detail?: string}[], warnings: {code: string, character?: string, detail?: string}[]}}
 *   Errors forbid saving; warnings are shown.
 */
export const validateCast = (cast, { reservedNames = [], takenAgeGroups = [], weeks = [], now = new Date() } = {}) => {
  const errors = [];
  const warnings = [];
  const characters = cast.characters || [];
  const byKey = new Map(characters.map(character => [character.key, character]));

  if (!cast.name) errors.push({ code: 'name-required' });
  if (cast.ageGroups.length === 0) errors.push({ code: 'age-groups-required' });
  for (const age of cast.ageGroups.filter(age => takenAgeGroups.includes(age))) errors.push({ code: 'age-group-taken', detail: age });
  if (characters.length === 0) errors.push({ code: 'characters-required' });

  const mains = characters.filter(character => character.role === 'main');
  if (characters.length > 0 && mains.length === 0) errors.push({ code: 'main-required' });
  const maxMain = Math.min(...cast.ageGroups.map(age => MAX_MAIN[age] ?? DEFAULT_MAX_MAIN), DEFAULT_MAX_MAIN);
  if (mains.length > maxMain) warnings.push({ code: 'too-many-main', detail: `${mains.length}/${maxMain}` });

  const names = new Map();
  const reserved = new Set(reservedNames.map(nameKey));
  for (const character of characters) {
    const key = nameKey(character.name);
    if (!character.name) { errors.push({ code: 'character-name-required', character: character.key }); continue; }
    if (names.has(key)) errors.push({ code: 'duplicate-name', character: character.key, detail: character.name });
    names.set(key, character);
    if (reserved.has(key)) errors.push({ code: 'reserved-name', character: character.key, detail: character.name });
    if (character.age !== null && (character.age < 0 || character.age > 120)) errors.push({ code: 'invalid-age', character: character.key });
    if (character.age === null && isHuman(character)) warnings.push({ code: 'age-missing', character: character.key });
    if (!character.visual && !Object.values(character.physical).some(Boolean)) warnings.push({ code: 'appearance-missing', character: character.key });
    for (const relation of character.relations) {
      if (!byKey.has(relation.to)) errors.push({ code: 'unknown-relation', character: character.key, detail: relation.to });
      if (relation.to === character.key) errors.push({ code: 'self-relation', character: character.key });
    }
  }

  // Ages of a family: a parent is much older than the child, a grandparent older than a parent
  for (const character of characters.filter(c => c.age !== null && isHuman(c))) {
    for (const relation of character.relations) {
      const other = byKey.get(relation.to);
      if (!other || other.age === null || !isHuman(other)) continue;
      if (relation.type === 'parent' && character.age - other.age < MIN_PARENT_GAP) {
        errors.push({ code: 'parent-age', character: character.key, detail: other.name });
      }
      if (relation.type === 'grandparent' && character.age - other.age < 2 * MIN_PARENT_GAP) {
        errors.push({ code: 'grandparent-age', character: character.key, detail: other.name });
      }
    }
  }

  // A name told only in the universe ("le chat Sweety"): the AI invents its look, the audit sees a stranger
  const calendar = new Set(CALENDAR_WORDS.map(nameKey));
  // A name after a place preposition is a place ("à Lille", "près de Rouen"), not a character
  const universeNames = [...new Set([...String(cast.universe || '').matchAll(/(?:^|[\s,;:])([\p{L}']+)[,;:]?\s(\p{Lu}[\p{Ll}-]{2,})/gu)]
    .filter(match => /\p{Ll}/u.test(match[1][0]) && !PLACE_WORDS.has(match[1].toLowerCase().replace(/^.*'/, '')))
    .map(match => match[2]))]
    .filter(name => !names.has(nameKey(name)) && !calendar.has(nameKey(name)));
  for (const name of universeNames) warnings.push({ code: 'universe-character', detail: name });

  // Human heroes about the age of the readers, on every week generated (birthdays included)
  const checkWeeks = weeks.length ? weeks : [cast.referenceWeek];
  const low = Math.min(...cast.ageGroups.map(age => READER_AGES[age][0])) - HERO_AGE_MARGIN.below;
  const high = Math.max(...cast.ageGroups.map(age => READER_AGES[age][1])) + HERO_AGE_MARGIN.above;
  if (cast.ageGroups.length) {
    for (const hero of mains.filter(c => c.age !== null && isHuman(c))) {
      const ages = checkWeeks.map(week => ageAtWeek(hero, week, cast.referenceWeek, now));
      const outside = ages.filter(age => age < low || age > high);
      if (outside.length) warnings.push({ code: 'hero-age-range', character: hero.key, detail: `${Math.min(...ages)}-${Math.max(...ages)} / ${low}-${high}` });
    }
  }
  return { errors, warnings };
};
