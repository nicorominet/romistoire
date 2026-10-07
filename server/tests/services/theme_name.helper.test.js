import { describe, it, expect } from 'vitest';
import { normalizeThemeName, isSameThemeName, findSimilarThemes, groupSimilarThemes } from '../../services/helpers/theme_name.helper.js';

describe('theme name helper', () => {
  it.each([
    ["L'Amitié !", 'amitie'],
    ['Les  Océans', 'oceans'],
    ['  la Forêt-Noire ', 'foret noire'],
    ['The Moon', 'moon'],
    ['Cycle de l’eau', "cycle de l eau"],
  ])('should normalize %s to %s', (name, expected) => {
    expect(normalizeThemeName(name)).toBe(expected);
  });

  it('should match case, accents, articles and plurals', () => {
    expect(isSameThemeName('Océan', 'les oceans')).toBe(true);
    expect(isSameThemeName('Animal', 'Animaux')).toBe(true);
    expect(isSameThemeName('Nature', 'NATURE')).toBe(true);
    expect(isSameThemeName('Nature', 'Natation')).toBe(false);
    expect(isSameThemeName('', '')).toBe(false);
  });

  it('should find similar themes and group duplicates', () => {
    const themes = [{ name: 'Océan' }, { name: 'les océans' }, { name: 'Amitié' }, { name: 'Espace' }, { name: "L'espace" }];

    expect(findSimilarThemes('Ocean', themes).map(t => t.name)).toEqual(['Océan', 'les océans']);
    expect(groupSimilarThemes(themes).map(group => group.map(t => t.name))).toEqual([
      ['Océan', 'les océans'],
      ['Espace', "L'espace"]
    ]);
  });
});
