/**
 * Quality gate of generated stories, from the content audit of October 2026 (245 stories read):
 * - normalizeTypography fixes what is safe to fix without reading (quotes, non-breaking spaces);
 * - detectDefects finds what must be rewritten: the generation slips left in the text (Asian characters,
 *   English words, self-corrections, instructions written in the story, a story copied twice), the length
 *   and the missing dialogue quotes. Each defect carries the instruction given to the model on its second try.
 * Pure functions: no I/O.
 */

const NBSP = ' ';
/** Thin non-breaking space, before ; ! ? (French typography). */
const NNBSP = ' ';

const CJK = /[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]/gu;
const ENGLISH = /(?<![\p{L}'’-])(the|and|with|of|cardboard)(?![\p{L}'’-])/giu;
/** A sentence fixed in place instead of rewritten ("un écrou, non un écureuil", "Le lendemain, ou plutôt le soir même"). */
const SELF_CORRECTIONS = [
  /\p{L}+, non (?:un|une|le|la|les|des) \p{L}+/iu,
  /\b(?:le lendemain|hier|demain|ce soir|ce matin|la veille),? ou plutôt\b/iu
];
/** The instructions written in the story ("suggère subtilement", "le sommet du suspense", "la semaine quarante-deux"). */
const PROMPT_LEAK = /(cliffhanger|nos (?:petits |jeunes )?lecteurs|série d'histoires|suggère subtilement|sommet du suspense|plan de la semaine|la semaine (?:vingt|trente|quarante|cinquante)[\p{L}-]*)/iu;
/** A paragraph that reports speech ("…, dit-il", "… ? demande Zoé"). */
const SPEECH = /(?:[,!?…]|\.\.\.)\s*(?:dit|demande|répond|chuchote|murmure|s'exclame|s'écrie|crie|explique|ajoute|lance|souffle)(?:-t)?(?:-(?:il|elle|ils|elles))?\b/iu;
const QUOTE_MARK = /[«"“]/;

/** Overlap above which two stories are the same text (S47 2-3: Wednesday was Monday copied). */
const DUPLICATE_SHARE = 0.9;
const SHINGLE_SIZE = 8;
/** Longer than this × the maximum of the age: rewritten shorter (S44 4-6 was 2.3×). */
const LONG_RATIO = 1.3;

const words = (text) => String(text || '').split(/\s+/).filter(Boolean);
const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeTitle = (title) => normalize(title).replace(/^(le|la|les|l|un|une|des) /, '');

/**
 * Safe typographic fixes of one paragraph or title: French quotes, non-breaking spaces, ellipsis.
 * Text that is already correct is left as is.
 * @param {string} text
 * @returns {string}
 */
export const normalizeTypography = (text) => {
  let result = String(text ?? '');
  // CJK corner brackets used as quotes: a well-formed pair becomes « », a stray bracket goes
  result = result.replace(/「([^「」]*)」/g, '«$1»').replace(/[「」『』]/g, '');
  // Curly quotes, then straight quotes when they pair up
  result = result.replace(/“([^“”]*)”/g, '«$1»').replace(/[“”]/g, '"');
  if ((result.match(/"/g) || []).length % 2 === 0) {
    let open = true;
    result = result.replace(/"/g, () => {
      const mark = open ? '«' : '»';
      open = !open;
      return mark;
    });
  }
  result = result.replace(/\.\.\.(?!\.)/g, '…');
  // Non-breaking spaces inside the quotes and before ; : ! ? (not in times like 10:30)
  result = result
    .replace(/«[   ]*/g, `«${NBSP}`)
    .replace(/[   ]*»/g, `${NBSP}»`)
    .replace(/(?<=[\p{L}\p{N}»)…])[   ]*([;!?])/gu, `${NNBSP}$1`)
    .replace(/(?<=[\p{L}»)…])[   ]*:(?!\d)/gu, `${NBSP}:`);
  return result;
};

/**
 * normalizeTypography on the text of an HTML content (tags and attributes untouched).
 * @param {string} html
 * @returns {string}
 */
export const normalizeHtmlTypography = (html) =>
  String(html ?? '').replace(/(^|>)([^<]+)/g, (match, start, text) => `${start}${normalizeTypography(text)}`);

const shinglesOf = (text) => {
  const list = normalize(text).split(' ');
  const set = new Set();
  for (let i = 0; i + SHINGLE_SIZE <= list.length; i++) set.add(list.slice(i, i + SHINGLE_SIZE).join(' '));
  return set;
};

/** Share of the shorter text found in the other one (8-word shingles). */
export const overlapShare = (a, b) => {
  const first = shinglesOf(a);
  const second = shinglesOf(b);
  if (first.size === 0 || second.size === 0) return 0;
  let common = 0;
  for (const shingle of first) if (second.has(shingle)) common++;
  return common / Math.min(first.size, second.size);
};

/** Blocking defects are asked again; the others are only reported. */
export const BLOCKING_DEFECTS = new Set(['cjk', 'english', 'prompt-leak', 'duplicate', 'too-long']);

/**
 * Defects of generated stories.
 * @param {{title?: string, day?: string, paragraphs: string[]}[]} stories - Parsed stories (one answer).
 * @param {{targetWords?: {min: number, max: number}, avoidTitles?: string[], previousTexts?: string[]}} [options]
 *   previousTexts: stories already written this week (a new day must not copy them).
 * @returns {{index: number, code: string, blocking: boolean, detail: string, hint: string}[]}
 */
export const detectDefects = (stories, { targetWords, avoidTitles = [], previousTexts = [] } = {}) => {
  const defects = [];
  const texts = (stories || []).map(story => (story.paragraphs || []).join('\n'));
  const usedTitles = new Set(avoidTitles.map(normalizeTitle).filter(Boolean));
  const add = (index, code, detail, hint) => defects.push({ index, code, blocking: BLOCKING_DEFECTS.has(code), detail, hint });

  (stories || []).forEach((story, index) => {
    const text = texts[index];
    const label = story.day ? `${story.day} : ` : '';

    const cjk = text.match(CJK);
    if (cjk) add(index, 'cjk', [...new Set(cjk)].join(' '), `${label}n'écrivez aucun caractère d'un autre alphabet (vous aviez écrit « ${[...new Set(cjk)].join(' ')} »).`);

    const english = text.match(ENGLISH);
    if (english) add(index, 'english', [...new Set(english.map(w => w.toLowerCase()))].join(', '), `${label}écrivez uniquement en français (vous aviez écrit « ${[...new Set(english)].join(', ')} »).`);

    const leak = text.match(PROMPT_LEAK);
    if (leak) add(index, 'prompt-leak', leak[0], `${label}le récit ne doit jamais parler de la consigne (vous aviez écrit « ${leak[0]} »).`);

    const correction = SELF_CORRECTIONS.map(pattern => text.match(pattern)).find(Boolean);
    if (correction) add(index, 'self-correction', correction[0], `${label}écrivez directement la bonne phrase, sans vous corriger dans le texte (« ${correction[0]} »).`);

    const others = [...texts.slice(0, index), ...texts.slice(index + 1), ...previousTexts];
    if (others.some(other => overlapShare(text, other) > DUPLICATE_SHARE)) {
      add(index, 'duplicate', story.title || '', `${label}cette histoire recopiait une autre histoire de la semaine : écrivez une histoire nouvelle pour ce jour.`);
    }

    const count = words(text).length;
    if (targetWords?.max && count > targetWords.max * LONG_RATIO) {
      add(index, 'too-long', `${count} mots`, `${label}votre histoire faisait ${count} mots : ne dépassez pas ${targetWords.max} mots.`);
    }

    const speech = (story.paragraphs || []).filter(paragraph => SPEECH.test(paragraph) && !QUOTE_MARK.test(paragraph));
    if (speech.length >= 2) add(index, 'missing-quotes', `${speech.length} paragraphes`, `${label}mettez chaque réplique entre guillemets « … ».`);

    if (story.title && usedTitles.has(normalizeTitle(story.title))) {
      add(index, 'used-title', story.title, `${label}le titre « ${story.title} » est déjà utilisé : choisissez-en un autre.`);
    }
  });
  return defects;
};

/** Number of blocking defects: the second try is kept when it has fewer. */
export const blockingCount = (defects) => defects.filter(defect => defect.blocking).length;
