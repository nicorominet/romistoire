import { describe, it, expect } from 'vitest';
import { PromptHelper } from '../../services/helpers/prompt.helper.js';

describe('PromptHelper age handling', () => {
  it.each(['2-3', '4-6', '7-9', '10-12', '13-15', '16-18'])('should accept "%s" as sent by the client', (age) => {
    const profile = PromptHelper.getAgeProfile(age);

    expect(profile).toEqual(PromptHelper.getAgeProfile(`${age} ans`));
    expect(profile.wordCount).not.toBe('');
    expect(profile.storyStyle).not.toBe('');
    expect(profile.illustrationStyle).not.toBe('');
  });

  it('should fall back to the 4-6 profile for an unknown age', () => {
    expect(PromptHelper.getAgeProfile('99')).toEqual(PromptHelper.getAgeProfile('4-6'));
  });

  it('should put the target length in the prompt', () => {
    const prompt = PromptHelper.buildStoryPrompt({ theme: 'La pluie', age: '4-6', day: 'Lundi' });

    expect(prompt).toContain('environ 300-450 mots');
    expect(prompt).toContain('4-6 ans');
  });
});
