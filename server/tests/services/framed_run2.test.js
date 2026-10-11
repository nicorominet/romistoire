// @vitest-environment node
// Run 2 of week 43 (11 Oct. 2026): foreign scripts, look lines, durable facts, length rules.
import { describe, it, expect } from 'vitest';
import { detectDefects } from '../../services/helpers/story_quality.helper.js';
import { characterLook } from '../../services/helpers/cast_look.helper.js';
import { buildWeekAuditPrompt } from '../../services/helpers/week_audit.helper.js';
import { PromptHelper } from '../../services/helpers/prompt.helper.js';

const codes = (text) => detectDefects([{ day: 'Dimanche', paragraphs: [text] }]).map(defect => defect.code);

describe('foreign scripts', () => {
  it('flags any alphabet other than Latin and Greek', () => {
    expect(codes('Le chat సౌ Sweety s\'est endormi.')).toEqual(['cjk']);
    expect(codes('Il dit ዚያ en riant.')).toEqual(['cjk']);
    expect(codes('Un mot russe : привет.')).toEqual(['cjk']);
    expect(detectDefects([{ paragraphs: ['Le chat సౌ Sweety.'] }])[0]).toMatchObject({ blocking: true });
  });

  it('leaves French and the Greek letters of science alone', () => {
    expect(codes('Léonie, à l\'école, mange un œuf ; ça va ? « Oui ! »')).toEqual([]);
    expect(codes('La longueur d\'onde λ et le nombre π.')).toEqual([]);
  });
});

describe('look lines', () => {
  it('says "1 an" and lowercases the free gender values', () => {
    expect(characterLook({ name: 'Antonin', gender: 'Garcons', currentAge: 1, physical: { hair: 'brun' } }))
      .toBe('Antonin (garcons, 1 an) : cheveux brun');
  });
});

describe('prompts', () => {
  it('keeps the length when the descriptions leave the text', () => {
    expect(PromptHelper.getCastSection({ characters: [{ key: 'l', name: 'Léonie', role: 'main' }] }))
      .toContain("Remplacez ces descriptions par de l'action, des dialogues et des sensations : la longueur demandée reste la même.");
  });

  it('asks the audit for lasting facts only', () => {
    const prompt = buildWeekAuditPrompt({ cast: { characters: [] }, stories: [{ day: 'Lundi', title: 'T', text: 'x' }] });
    expect(prompt).toContain('jamais une activité, un déguisement, un repas ou une sortie de la semaine');
  });
});
