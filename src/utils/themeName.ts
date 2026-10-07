/**
 * Theme name rules. Mirror of server/services/helpers/theme_name.helper.js: keep both in sync.
 */

const LEADING_ARTICLES = /^(?:(?:le|la|les|un|une|des|du|de la|the|a|an)\s+|l')/;

/**
 * Comparison key of a theme name: lowercase, no accents, no leading article, no punctuation.
 * "L'Amitié !" -> "amitie".
 */
export const normalizeThemeName = (name: string | null | undefined): string => String(name || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[’`]/g, "'")
  .trim()
  .replace(LEADING_ARTICLES, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/[\s-]+/g, ' ')
  .trim()
  .slice(0, 100);

const singularKey = (key: string) => key
  .split(' ')
  .map(word => {
    if (word.length > 4 && word.endsWith('aux')) return `${word.slice(0, -3)}al`;
    if (word.length > 3 && /[sx]$/.test(word)) return word.slice(0, -1);
    return word;
  })
  .join(' ');

/** Whether two names designate the same theme (same key, or singular/plural variants). */
export const isSameThemeName = (a: string, b: string): boolean => {
  const keyA = normalizeThemeName(a);
  const keyB = normalizeThemeName(b);
  if (!keyA || !keyB) return false;
  return keyA === keyB || singularKey(keyA) === singularKey(keyB);
};

/** Themes designating the same theme as `name`. */
export const findSimilarThemes = <T extends { name: string }>(name: string, themes: T[]): T[] =>
  themes.filter(theme => isSameThemeName(name, theme.name));

/** Whether `name` matches the search `term` (accents, case and articles ignored). */
export const matchesThemeSearch = (name: string, term: string): boolean => {
  const key = normalizeThemeName(term);
  return !key || normalizeThemeName(name).includes(key);
};
