/**
 * Look of the characters of a framed series, for the illustrations: one fixed line per character, given to every AI
 * prompt that draws or describes a picture (story prompt, illustration description, prompt pasted into the image
 * tool). The story text itself only evokes it.
 * Pure functions: no I/O.
 */

const PHYSICAL = [['hair', 'cheveux'], ['eyes', 'yeux'], ['build', 'silhouette'], ['clothing', 'tenue :'], ['distinctive', '']];

const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * "Léonie (fillette, féminin, 3 ans) : petite fille aux boucles dorées… ; cheveux dorés, yeux bleus, tenue : robe".
 * @param {Object} character - Character of a bible, ideally as told this week (castForWeek: currentAge).
 * @returns {string} "" without name.
 */
export const characterLook = (character) => {
  const name = String(character?.name || '').trim();
  if (!name) return '';
  const age = character.currentAge ?? character.age;
  // "fille", not "Fille" (free values of older bibles); "1 an", not "1 ans"
  const identity = [character.species, character.gender].map(part => String(part ?? '').trim().toLowerCase())
    .concat(age !== null && age !== undefined ? [`${age} ${age === 1 ? 'an' : 'ans'}`] : [])
    .filter(Boolean).join(', ');
  const physical = PHYSICAL
    .map(([field, label]) => {
      // "yeux bleu", not "yeux Bleu": the fields are typed like titles in the bible form
      const raw = String(character.physical?.[field] || '').trim();
      const value = raw.charAt(0).toLowerCase() + raw.slice(1);
      return value ? `${label ? `${label} ` : ''}${value}` : '';
    })
    .filter(Boolean).join(', ');
  const look = [String(character.visual || '').trim(), physical].filter(Boolean).join(' ; ');
  return `${name}${identity ? ` (${identity})` : ''}${look ? ` : ${look}` : ''}`;
};

/**
 * Characters of a bible shown in a picture: those named in its description, else the main characters.
 * @param {{characters?: Object[]}} cast
 * @param {string} description - Description of the illustration.
 * @returns {Object[]}
 */
export const charactersInPicture = (cast, description) => {
  const characters = (cast?.characters || []).filter(character => character?.name);
  const text = String(description || '');
  const named = characters.filter(character =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escape(character.name)}(?![\\p{L}\\p{N}])`, 'iu').test(text));
  return named.length ? named : characters.filter(character => character.role === 'main');
};

/**
 * Fixed look of the characters of a picture, as a block for an image prompt ("" without bible or characters).
 * @param {{characters?: Object[]}|null} cast - Cast as told the week of the story.
 * @param {string} description
 */
export const castLookBlock = (cast, description) => {
  const lines = charactersInPicture(cast, description).map(characterLook).filter(Boolean);
  return lines.length ? ['Personnages (apparence fixe à respecter) :', ...lines.map(line => `- ${line}`)].join('\n') : '';
};
