import { describe, it, expect } from 'vitest';
import { normalizeTypography, normalizeHtmlTypography, detectDefects, overlapShare, blockingCount } from '../../services/helpers/story_quality.helper.js';

const NBSP = ' ';
const NNBSP = ' ';
const story = (paragraphs, extra = {}) => ({ title: 'Titre', day: 'Lundi', paragraphs, ...extra });
const codes = (defects) => defects.map(defect => defect.code);
const longText = (seed) => Array.from({ length: 60 }, (_, i) => `${seed} mot${i} phrase${i % 7} suite${i % 5}`).join(' ');

describe('normalizeTypography', () => {
  it('should turn straight and curly quotes into French quotes with non-breaking spaces', () => {
    expect(normalizeTypography('"Regarde maman, le ciel prépare un bain !" s\'écrie la petite fille.'))
      .toBe(`«${NBSP}Regarde maman, le ciel prépare un bain${NNBSP}!${NBSP}» s'écrie la petite fille.`);
    expect(normalizeTypography('“Tu viens ?” demande-t-il.')).toBe(`«${NBSP}Tu viens${NNBSP}?${NBSP}» demande-t-il.`);
  });

  it('should repair the CJK brackets used as quotes in S43 7-9', () => {
    expect(normalizeTypography('」「Tu crois qu\'on trouvera des sucreries ?')).toBe(`Tu crois qu'on trouvera des sucreries${NNBSP}?`);
    expect(normalizeTypography('「Bonjour」 dit-il.')).toBe(`«${NBSP}Bonjour${NBSP}» dit-il.`);
  });

  it('should keep odd straight quotes, times and correct text as they are', () => {
    expect(normalizeTypography('Il mesure 5" de haut')).toBe('Il mesure 5" de haut');
    expect(normalizeTypography('Rendez-vous à 10:30 précises.')).toBe('Rendez-vous à 10:30 précises.');
    const correct = `«${NBSP}Bravo${NNBSP}!${NBSP}» dit maman${NBSP}: c'est fini…`;
    expect(normalizeTypography(correct)).toBe(correct);
    expect(normalizeTypography('Et alors...')).toBe('Et alors…');
  });

  it('should only change the text of an HTML content', () => {
    expect(normalizeHtmlTypography('<p>"Oui !" dit-il.</p><img src="a.png" alt="x">'))
      .toBe(`<p>«${NBSP}Oui${NNBSP}!${NBSP}» dit-il.</p><img src="a.png" alt="x">`);
  });
});

describe('detectDefects', () => {
  it('should find the generation slips of the audit', () => {
    const defects = detectDefects([
      story(['Regarde ce petit merle. L\'oiseau傾écoute attentivement.'], { day: 'Mardi' }),
      story(['Les cartons en the carton vide s\'empilaient dans le couloir.'], { day: 'Dimanche' }),
      story(['Elle s\'arrête pour observer un écrou, non un écureuil farceur.']),
      story(['Le lendemain, ou plutôt le soir même, la glace était dure.']),
      story(['Et si ce week-end… suggère subtilement la petite chauve-souris.']),
      story(['Ils réalisèrent que cette semaine quarante-deux resterait gravée.'])
    ]);
    expect(codes(defects)).toEqual(['cjk', 'english', 'self-correction', 'self-correction', 'prompt-leak', 'prompt-leak']);
    expect(defects[0].hint).toBe('Mardi : n\'écrivez aucun caractère d\'un autre alphabet (vous aviez écrit « 傾 »).');
    expect(defects[1].detail).toBe('the');
    expect(blockingCount(defects)).toBe(4);
  });

  it('should not flag a deliberate "ou plutôt", French words or a clean story', () => {
    expect(detectDefects([
      story(['Il faut séparer le bon grain de l\'ivraie, ou plutôt, la bonne châtaigne du fruit léger.']),
      story([`«${NBSP}Viens voir${NNBSP}!${NBSP}» dit Léonie. Ils boivent du thé au bord de l'eau.`])
    ])).toEqual([]);
  });

  it('should find a story copied from another day of the week, or from a day already written', () => {
    const monday = longText('casserole');
    const defects = detectDefects([story([monday]), story([longText('cygne')]), story([monday], { day: 'Mercredi' })]);
    expect(codes(defects)).toEqual(['duplicate', 'duplicate']);
    expect(overlapShare(monday, longText('cygne'))).toBe(0);

    expect(codes(detectDefects([story([monday], { day: 'Mercredi' })], { previousTexts: [monday] }))).toEqual(['duplicate']);
  });

  it('should find a story far too long, missing dialogue quotes and a title already used', () => {
    const defects = detectDefects([
      story([Array.from({ length: 1030 }, () => 'mot').join(' ')], { title: 'La danse des feuilles d\'or' }),
      story(['Regarde ce tronc moussu, chuchote Léonie.', 'Ne te décourage pas, murmure le vent.'], { title: 'Le Festin des oiseaux' })
    ], { targetWords: { min: 300, max: 450 }, avoidTitles: ['Le festin des oiseaux'] });
    expect(codes(defects)).toEqual(['too-long', 'missing-quotes', 'used-title']);
    expect(defects[0].hint).toContain('ne dépassez pas 450 mots');
    expect(defects.map(defect => defect.blocking)).toEqual([true, false, false]);
  });
});
