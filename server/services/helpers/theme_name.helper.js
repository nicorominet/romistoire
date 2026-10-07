/**
 * Theme name rules shared by the theme service, the AI generation and the weekly themes.
 * Mirrored on the client in src/utils/themeName.ts: keep both in sync.
 */

const LEADING_ARTICLES = /^(?:(?:le|la|les|un|une|des|du|de la|the|a|an)\s+|l')/;

/**
 * Comparison key of a theme name: lowercase, no accents, no leading article, no punctuation.
 * "L'Amitié !" -> "amitie", "Les  Océans" -> "oceans".
 * @param {string} name
 * @returns {string}
 */
export const normalizeThemeName = (name) => String(name || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[’`]/g, "'")
  .trim()
  .replace(LEADING_ARTICLES, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/[\s-]+/g, ' ')
  .trim()
  .slice(0, 100);

/** Singular form of a normalized key, word by word ("oceans" -> "ocean", "animaux" -> "animal"). */
const singularKey = (key) => key
  .split(' ')
  .map(word => {
    if (word.length > 4 && word.endsWith('aux')) return `${word.slice(0, -3)}al`;
    if (word.length > 3 && /[sx]$/.test(word)) return word.slice(0, -1);
    return word;
  })
  .join(' ');

/**
 * Whether two theme names designate the same theme (same key, or singular/plural variants).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const isSameThemeName = (a, b) => {
  const keyA = normalizeThemeName(a);
  const keyB = normalizeThemeName(b);
  if (!keyA || !keyB) return false;
  return keyA === keyB || singularKey(keyA) === singularKey(keyB);
};

/**
 * Themes whose name designates the same theme as `name`.
 * @template {{name: string}} T
 * @param {string} name
 * @param {T[]} themes
 * @returns {T[]}
 */
export const findSimilarThemes = (name, themes) => themes.filter(theme => isSameThemeName(name, theme.name));

/**
 * Groups themes designating the same theme (only groups with at least 2 themes).
 * @template {{name: string}} T
 * @param {T[]} themes
 * @returns {T[][]}
 */
export const groupSimilarThemes = (themes) => {
  const groups = new Map();
  for (const theme of themes) {
    const key = singularKey(normalizeThemeName(theme.name));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(theme);
  }
  return [...groups.values()].filter(group => group.length > 1);
};
