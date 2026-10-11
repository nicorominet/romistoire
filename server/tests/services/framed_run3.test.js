// @vitest-environment node
// Run 3 of week 43 (11 Oct. 2026): the 7 stories opened the same way; the look lines kept the capitals of the form.
import { describe, it, expect } from 'vitest';
import { PromptHelper, ALL_WEEK } from '../../services/helpers/prompt.helper.js';
import { characterLook } from '../../services/helpers/cast_look.helper.js';

describe('openings of a week written in one answer', () => {
  const prompt = PromptHelper.buildStoryPrompt({ theme: 'Halloween', age: '2-3', day: ALL_WEEK, weekNumber: 43 });

  it('gives one kind of opening per day', () => {
    expect(prompt).toContain('Lundi par une action ; Mardi par un bruit ou une odeur ; Mercredi par la réplique d\'un autre personnage que le héros');
    expect(prompt).toContain('Dimanche par un moment calme');
  });

  it('forbids the "Hier, …, et aujourd\'hui" formula', () => {
    expect(prompt).toContain('jamais avec la formule « Hier, …, et aujourd\'hui … »');
  });
});

describe('look lines', () => {
  it('starts the physical values with a lower-case letter', () => {
    expect(characterLook({ name: 'Léonie', currentAge: 3, physical: { hair: 'dorés', eyes: 'Bleu', build: 'Fine', clothing: 'Robe' } }))
      .toBe('Léonie (3 ans) : cheveux dorés, yeux bleu, silhouette fine, tenue : robe');
  });
});
