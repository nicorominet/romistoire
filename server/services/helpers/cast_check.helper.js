/**
 * Local checks of a framed series (no AI request): what a story says against the bible of its series.
 * - per story (quality gate, second try on the blocking ones): a hero of another series, a wrong age,
 *   a main character missing, a hair color that changed;
 * - per week (audit): a new name that keeps coming back, as if it had joined the cast.
 * Pure functions: no I/O.
 */

/** Words of the French numbers up to 99 ("quarante-trois" = quarante + trois, "soixante-dix-sept" = 60 + 10 + 7). */
const NUMBER_WORDS = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60
};
/** Hair colors by family: "châtain" and "brun" are the same family, "roux" and "blond" are not. */
const HAIR_FAMILIES = {
  blond: ['blond', 'blonde', 'blonds', 'blondes', 'dorés', 'dorées', 'doré', 'dorée'],
  brun: ['brun', 'brune', 'bruns', 'brunes', 'châtain', 'châtains', 'marron', 'chocolat'],
  roux: ['roux', 'rousse', 'rousses', 'auburn', 'cuivrés', 'cuivré', 'flamboyants'],
  noir: ['noir', 'noire', 'noirs', 'noires', 'corbeau', 'ébène'],
  gris: ['gris', 'grise', 'grises', 'blanc', 'blanche', 'blancs', 'blanches', 'argentés', 'argenté']
};
/** Name and the age said right after it ("Léo, cinq ans", "Léo, qui avait 7 ans"), within this many characters. */
const AGE_WINDOW = 40;
/** Name and a hair color said right after it, within this many characters. */
const HAIR_WINDOW = 80;
/** A name unknown to the bible that comes back on this many days of a week: it settles in the cast. */
export const RECURRING_DAYS = 3;
/** Capitalized words of the calendar: feasts, months, days (never a character). */
export const CALENDAR_WORDS = [
  'Toussaint', 'Halloween', 'Noël', 'Pâques', 'Pentecôte', 'Ascension', 'Épiphanie', 'Chandeleur', 'Mardi gras', 'Carnaval',
  'Saint-Valentin', 'Saint-Nicolas', 'Saint-Sylvestre', 'Réveillon', 'Armistice', 'Nouvel An', 'Fête des mères', 'Fête des pères',
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
];

const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word, case-sensitive match of a name ("Léo" but not "Léon"). */
const nameRegex = (name, flags = 'u') => new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, flags);
const hairFamily = (text) => {
  const words = String(text || '').toLowerCase().split(/[^\p{L}-]+/u);
  return Object.keys(HAIR_FAMILIES).find(family => HAIR_FAMILIES[family].some(word => words.includes(word))) || null;
};
/**
 * Value of a French number written in words, up to 99: the words add up, except "quatre-vingt" (80).
 * @returns {number|null} null when a word is not a number.
 */
export const frenchNumber = (raw) => {
  const words = String(raw || '').toLowerCase().trim().split(/\s+et\s+|-et-|[-\s]+/).filter(Boolean);
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'quatre' && /^vingts?$/.test(words[i + 1] || '')) {
      total += 80;
      i++;
      continue;
    }
    if (!(words[i] in NUMBER_WORDS)) return null;
    total += NUMBER_WORDS[words[i]];
  }
  return words.length ? total : null;
};
const ageValue = (raw) => (/^\d+$/.test(raw) ? Number(raw) : frenchNumber(raw));
const NUMBER_WORD = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');
// The whole number, never its end ("quarante-trois ans" is 43, not 3): no letter, digit or hyphen before it
const AGE_RE = new RegExp(
  `(?<![\\p{L}\\p{N}-])(\\d{1,3}|(?:${NUMBER_WORD})(?:(?:-et-|\\s+et\\s+|-)(?:${NUMBER_WORD}))*)\\s+ans(?![\\p{L}])`, 'iu'
);

/** Names that look like a first name: one word, capitalized, 3 letters or more (series titles left out). */
const firstNames = (names) => [...new Set((names || []).map(name => String(name || '').trim()))]
  .filter(name => /^\p{Lu}[\p{L}-]{2,}$/u.test(name));

/**
 * Defects of stories written with a bible.
 * @param {{title?: string, day?: string, paragraphs: string[], illustration_prompt?: string}[]} stories
 * @param {{characters: Object[]}} cast - Cast as told this week (castForWeek: currentAge).
 * @param {{reservedNames?: string[]}} [options] - Heroes of the other series.
 * @returns {{index: number, code: string, detail: string, hint: string}[]} The caller sets `blocking`.
 */
export const detectCastDefects = (stories, cast, { reservedNames = [] } = {}) => {
  const characters = (cast?.characters || []).filter(character => character?.name);
  const own = new Set(characters.map(character => character.name.toLowerCase()));
  const reserved = firstNames(reservedNames).filter(name => !own.has(name.toLowerCase()));
  const defects = [];

  (stories || []).forEach((story, index) => {
    const text = (story.paragraphs || []).join('\n');
    const illustration = String(story.illustration_prompt || story.illustrationPrompt || '');
    const label = story.day ? `${story.day} : ` : '';
    const add = (code, detail, hint) => defects.push({ index, code, detail, hint: `${label}${hint}` });

    for (const name of reserved) {
      if (nameRegex(name).test(text)) add('reserved-name', name, `« ${name} » est le héros d'une autre série : n'utilisez que les personnages de la BIBLE.`);
    }

    for (const character of characters) {
      const mentions = [...text.matchAll(nameRegex(character.name, 'gu'))];

      if (character.currentAge !== null && character.currentAge !== undefined) {
        const wrong = mentions
          .map(match => text.slice(match.index + character.name.length, match.index + character.name.length + AGE_WINDOW))
          // Stop at the end of the sentence or at another character of the cast (the age after it is theirs)
          .map(after => after.split(/[.!?…]/)[0])
          .map(after => after.slice(0, characters
            .filter(other => other !== character)
            .map(other => after.search(nameRegex(other.name)))
            .filter(found => found >= 0)
            .reduce((cut, found) => Math.min(cut, found), after.length)))
          .map(after => after.match(AGE_RE))
          .filter(Boolean)
          .map(match => ageValue(match[1]))
          .filter(age => age !== null && age !== character.currentAge);
        if (wrong.length) {
          add('wrong-age', `${character.name} ${wrong[0]}/${character.currentAge}`,
            `${character.name} a ${character.currentAge} ans cette semaine (vous aviez écrit ${wrong[0]} ans).`);
        }
      }

      if (character.role === 'main' && mentions.length === 0) {
        add('missing-main', character.name, `${character.name}, personnage principal, doit être au cœur de l'histoire.`);
      }

      const family = hairFamily(character.physical?.hair) || hairFamily(character.visual);
      if (family) {
        for (const source of [text, illustration]) {
          const said = [...source.matchAll(nameRegex(character.name, 'gu'))]
            .map(match => source.slice(match.index, match.index + HAIR_WINDOW).split(/[.!?;]/)[0])
            .map(sentence => sentence.match(/cheveux\s+([\p{L}-]+)/iu)?.[1])
            .map(hairFamily)
            .find(other => other && other !== family);
          if (said) {
            add('trait-conflict', `${character.name} ${said}/${family}`,
              `${character.name} a les cheveux ${character.physical?.hair || family} : gardez exactement l'apparence de la BIBLE.`);
            break;
          }
        }
      }
    }
  });
  return defects;
};

/**
 * Names unknown to the bible that come back on several days of a week (a guest that settles in the cast).
 * A name is a capitalized word inside a sentence, never at its start.
 * @param {string[]} texts - Texts of the days of the week.
 * @param {{characters: Object[]}} cast
 * @param {string[]} [known] - Other texts whose words are allowed (the series title, the topic of the week…).
 *   The universe, the rules of the bible and the calendar words are always allowed.
 * @returns {{name: string, days: number}[]}
 */
export const recurringUnknownNames = (texts, cast, known = []) => {
  const allowed = new Set([
    ...(cast?.characters || []).map(character => character.name),
    cast?.universe, ...(cast?.rules || []),
    ...known, ...CALENDAR_WORDS
  ].flatMap(text => String(text || '').split(/[^\p{L}-]+/u)).filter(Boolean).map(word => word.toLowerCase()));
  const days = new Map();
  for (const text of texts || []) {
    const names = new Set([...String(text || '').matchAll(/(?<=[\p{Ll},;:]\s)(\p{Lu}[\p{Ll}-]{2,})/gu)].map(match => match[1]));
    for (const name of names) {
      if (!allowed.has(name.toLowerCase())) days.set(name, (days.get(name) || 0) + 1);
    }
  }
  return [...days].filter(([, count]) => count >= RECURRING_DAYS).map(([name, count]) => ({ name, days: count }));
};
