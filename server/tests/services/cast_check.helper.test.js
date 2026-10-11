// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { detectCastDefects, recurringUnknownNames } from '../../services/helpers/cast_check.helper.js';
import { detectDefects } from '../../services/helpers/story_quality.helper.js';

const cast = {
  characters: [
    { name: 'Léo', role: 'main', currentAge: 5, physical: { hair: 'bruns bouclés' } },
    { name: 'Mia', role: 'main', currentAge: 7, visual: 'fillette aux tresses rousses' },
    { name: 'Papa', role: 'recurring', currentAge: 38 }
  ]
};
const story = (paragraphs, extra = {}) => ({ day: 'Lundi', title: 'T', paragraphs, ...extra });
const codes = (defects) => defects.map(defect => defect.code);

describe('detectCastDefects', () => {
  it('accepts a story that follows the bible', () => {
    const defects = detectCastDefects([story(['Léo, cinq ans, court vers Mia et Papa, 38 ans.', 'Mia rit.'])], cast, { reservedNames: ['Antonin'] });
    expect(defects).toEqual([]);
  });

  it('finds a wrong age, in figures or in words', () => {
    expect(detectCastDefects([story(['Léo, qui avait 6 ans, et Mia jouent.'])], cast)).toMatchObject([{ code: 'wrong-age', detail: 'Léo 6/5' }]);
    expect(codes(detectCastDefects([story(['Mia, huit ans, appelle Léo.'])], cast))).toEqual(['wrong-age']);
    // The age said after another character belongs to that one
    expect(detectCastDefects([story(['Léo regarde Papa, 38 ans, et Mia.'])], cast)).toEqual([]);
  });

  it('finds the hero of another series and a missing main character', () => {
    const defects = detectCastDefects([story(['Léo joue avec Antonin.'])], cast, { reservedNames: ['Antonin', 'Les Explorateurs'] });
    expect(codes(defects)).toEqual(['reserved-name', 'missing-main']);
    expect(defects[1].detail).toBe('Mia');
  });

  it('finds a hair color that changed, in the text or the illustration', () => {
    const inText = detectCastDefects([story(['Léo secoue ses cheveux blonds. Mia sourit.'])], cast);
    expect(inText).toMatchObject([{ code: 'trait-conflict', detail: 'Léo blond/brun' }]);
    const inPicture = detectCastDefects([story(['Léo et Mia.'], { illustration_prompt: 'Mia, cheveux noirs, court.' })], cast);
    expect(codes(inPicture)).toEqual(['trait-conflict']);
  });

  it('is part of the quality gate only with a bible, the age and names being blocking', () => {
    const stories = [story(['Léo, 9 ans, et Mia.'])];
    expect(detectDefects(stories)).toEqual([]);
    expect(detectDefects(stories, { cast })).toMatchObject([{ code: 'wrong-age', blocking: true }]);
  });
});

describe('recurringUnknownNames', () => {
  it('reports a guest that comes back three days, not a name of the bible or a sentence start', () => {
    const texts = ['Léo rencontre Bastien au port.', 'Ce matin, Bastien revient. Demain il pleut.', 'Mia et Bastien chantent.', 'Léo dort.'];
    expect(recurringUnknownNames(texts, cast)).toEqual([{ name: 'Bastien', days: 3 }]);
  });
});
