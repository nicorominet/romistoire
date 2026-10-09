import { PromptHelper } from './prompt.helper.js';
import { STORY_DAYS } from './story_schema.js';

/**
 * Extracts the first complete JSON object or array from a model answer.
 * Tolerates code fences and chatter around the JSON ("Voici l'histoire : {...}").
 * @param {string} text - Raw model answer.
 * @returns {string|null} The JSON substring, or null if none is balanced.
 */
export const extractJson = (text) => {
  const source = String(text || '').replace(/```(?:json)?/gi, '');
  const start = source.search(/[{[]/);
  if (start === -1) return null;

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      const open = stack.pop();
      if ((char === '}' && open !== '{') || (char === ']' && open !== '[')) return null;
      if (stack.length === 0) return source.slice(start, i + 1);
    }
  }
  return null;
};

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeThemes = (themes) => (Array.isArray(themes) ? themes : [])
  .filter(theme => theme && asText(theme.name))
  .map(theme => ({
    name: asText(theme.name),
    description: asText(theme.description),
    icon: asText(theme.icon),
    color: /^#[0-9a-f]{3,8}$/i.test(asText(theme.color)) ? asText(theme.color) : undefined
  }));

/** A single paragraph longer than this is split (the model put the whole story in one block). */
const SINGLE_PARAGRAPH_MAX = 600;
const SENTENCES_PER_PARAGRAPH = 3;

/**
 * Splits a story written as one block: on line breaks when there are some,
 * else every few sentences.
 */
export const splitLongParagraph = (text) => {
  const byLines = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  if (byLines.length > 1) return byLines;
  if (text.length <= SINGLE_PARAGRAPH_MAX) return [text];

  // Sentence ends: . ! ? … optionally followed by a closing quote
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+(?:\s*»)?|$)/g)?.map(s => s.trim()).filter(Boolean) || [text];
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(' '));
  }
  return paragraphs;
};

const normalizeParagraphs = (story) => {
  let paragraphs;
  if (Array.isArray(story.paragraphs)) {
    paragraphs = story.paragraphs.map(asText).filter(Boolean);
  } else {
    // Some models put the whole text in "content" or "text"
    const text = asText(story.paragraphs) || asText(story.content) || asText(story.text);
    paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }
  return paragraphs.length === 1 ? splitLongParagraph(paragraphs[0]) : paragraphs;
};

/**
 * Days of a whole week written in one answer.
 * - 7 stories whose days are not the 7 distinct days (e.g. two "Mardi"): days given by position, Monday to Sunday.
 * - Fewer stories: valid days kept, a repeated day removed (the client reports the story as "without day").
 * @param {Object[]} stories - Parsed stories ({ day, ... }).
 * @returns {{stories: Object[], fixed: number}} Stories and the number of days changed.
 */
export const assignWeekDays = (stories) => {
  if (!Array.isArray(stories)) return { stories, fixed: 0 };
  const days = stories.map(story => story.day);
  const distinct = new Set(days.filter(Boolean));

  if (stories.length === STORY_DAYS.length) {
    if (distinct.size === STORY_DAYS.length) return { stories, fixed: 0 };
    let fixed = 0;
    const result = stories.map((story, index) => {
      if (story.day === STORY_DAYS[index]) return story;
      fixed++;
      return { ...story, day: STORY_DAYS[index] };
    });
    return { stories: result, fixed };
  }

  const seen = new Set();
  let fixed = 0;
  const result = stories.map(story => {
    if (!story.day || !seen.has(story.day)) {
      if (story.day) seen.add(story.day);
      return story;
    }
    fixed++;
    return { ...story, day: null };
  });
  return { stories: result, fixed };
};

/** At most this many character sheets are kept. */
const MAX_CHARACTERS = 6;

/**
 * Context returned by the first day of a week generated day by day: the plan of the week
 * and the character sheets.
 * @param {string} text - Raw model answer.
 * @returns {{weekPlan: string[]|null, characters: {name: string, description: string}[]|null}}
 *   weekPlan: 7 lines (Monday to Sunday), null when absent or incomplete; characters: null when absent.
 */
export const extractWeekContext = (text) => {
  const empty = { weekPlan: null, characters: null };
  const json = extractJson(text);
  if (!json) return empty;
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return empty;
  }
  // "Lundi : Léo trouve une carte" -> "Léo trouve une carte" (the day is given by the position)
  const dayPrefix = new RegExp(`^(?:${STORY_DAYS.join('|')})\\s*[:–-]\\s*`, 'i');
  const plan = Array.isArray(data?.week_plan)
    ? data.week_plan.map(line => asText(line).replace(dayPrefix, '')).filter(Boolean)
    : [];
  const characters = Array.isArray(data?.characters)
    ? data.characters
      .map(character => ({ name: asText(character?.name), description: asText(character?.description) }))
      .filter(character => character.name)
      .slice(0, MAX_CHARACTERS)
    : [];
  return {
    weekPlan: plan.length === STORY_DAYS.length ? plan : null,
    characters: characters.length > 0 ? characters : null
  };
};

/** Plan of the week only (see extractWeekContext). */
export const extractWeekPlan = (text) => extractWeekContext(text).weekPlan;

/** A copied opening shorter than this (in characters) is left alone. */
const MIN_REPEATED_LENGTH = 20;

/** Comparison form of a sentence: case, quotes, punctuation spacing and whitespace ignored. */
const comparable = (text) => String(text || '')
  .toLowerCase()
  .replace(/[«»"“”'’]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/** A paragraph about the text itself is short: real story paragraphs that mention the word are longer. */
const META_PARAGRAPH_MAX = 300;
/** Characters compared between a paragraph and the illustration description. */
const ILLUSTRATION_PREFIX = 80;

/** "Un paragraphe de transition pour atteindre la longueur minimale requise…" */
const isMetaParagraph = (paragraph) => {
  const text = comparable(paragraph);
  if (/longueur minimale/.test(text)) return true;
  return text.length <= META_PARAGRAPH_MAX
    && /\bparagraphe\b/.test(text)
    && /transition|longueur|minimale|requise|dernier|autre|enrichir|clore|conclure/.test(text);
};

/** The illustration description written again inside the story. */
const isIllustrationParagraph = (paragraph, illustrationPrompt) => {
  if (/style (?:d'|de l'|d’)?(?:illustration|album)|illustration (?:jeunesse|style)/i.test(paragraph)) return true;
  const text = comparable(paragraph);
  const illustration = comparable(illustrationPrompt);
  if (!illustration || text.length < ILLUSTRATION_PREFIX) return false;
  return illustration.includes(text.slice(0, ILLUSTRATION_PREFIX));
};

/** A repeated group of 2 to 4 words is a slip of the model ("les bogues et les bogues et les branches"). */
const STUTTER = /((?:[\p{L}\p{N}'’-]+\s+){1,3}[\p{L}\p{N}'’-]+)\s+\1(?=[\s,.;:!?…»]|$)/giu;
/** Shorter repeated groups ("très très") are often on purpose. */
const STUTTER_MIN_LENGTH = 8;

/**
 * Removes a group of 2 to 4 words written twice in a row.
 * @returns {{text: string, count: number}}
 */
export const removeStutter = (paragraph) => {
  let count = 0;
  const text = paragraph.replace(STUTTER, (match, group) => {
    if (group.length < STUTTER_MIN_LENGTH) return match;
    count++;
    return group;
  });
  return { text, count };
};

/**
 * First two words of a story, normalized ("Hier, Léonie…" -> "hier léonie"), to spot openings
 * repeated from one day to the next.
 */
export const openingPattern = (paragraph) =>
  comparable(paragraph).replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');

/**
 * Number of stories that open with a forbidden reminder ("Hier", "Alors que"…) or with the same two words
 * as another story of the answer.
 * @param {{paragraphs: string[]}[]} stories
 * @param {string[]} forbidden - Forbidden openings (PromptHelper's FORBIDDEN_OPENINGS).
 */
export const countRepetitiveOpenings = (stories, forbidden = []) => {
  const patterns = stories.map(story => openingPattern(story.paragraphs[0] || ''));
  const forbiddenPatterns = forbidden.map(opening => openingPattern(opening));
  return patterns.filter((pattern, index) => pattern && (
    forbiddenPatterns.some(start => pattern === start || pattern.startsWith(`${start} `) || pattern.split(' ')[0] === start)
    || patterns.some((other, otherIndex) => otherIndex !== index && other === pattern)
  )).length;
};

/**
 * Removes what is not story text: comments about the text ("un paragraphe de transition pour atteindre
 * la longueur minimale…") and the illustration description copied into the paragraphs.
 * A story is never emptied.
 * @param {string[]} paragraphs
 * @param {string} [illustrationPrompt]
 * @returns {{paragraphs: string[], removed: number}}
 */
export const cleanStoryParagraphs = (paragraphs, illustrationPrompt = '') => {
  const kept = paragraphs.filter(paragraph => !isMetaParagraph(paragraph) && !isIllustrationParagraph(paragraph, illustrationPrompt));
  if (kept.length === 0) return { paragraphs, removed: 0 };
  let fixes = 0;
  const fixed = kept.map(paragraph => {
    const { text, count } = removeStutter(paragraph);
    fixes += count;
    return text;
  });
  return { paragraphs: fixed, removed: paragraphs.length - kept.length + fixes };
};

const splitSentences = (text) =>
  String(text || '').match(/[^.!?…]+(?:[.!?…]+(?:\s*»)?|$)/g)?.map(s => s.trim()).filter(Boolean) || [];

const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

/**
 * Splits the paragraphs longer than the size of the age group into groups of whole sentences
 * (models sometimes write 3 blocks of 100 words for 4-year-olds). The text itself is unchanged.
 * @param {string[]} paragraphs
 * @param {string} age - Age group ("4-6").
 * @returns {string[]}
 */
export const splitParagraphsForAge = (paragraphs, age) => {
  const max = PromptHelper.getAgeProfile(age).maxParagraphWords;
  if (!max || !Array.isArray(paragraphs)) return paragraphs;
  // Each new block aims at ~60 % of the maximum, so the split does not leave a tiny last block
  const target = Math.round(max * 0.6);
  return paragraphs.flatMap(paragraph => {
    if (wordCount(paragraph) <= max) return [paragraph];
    const sentences = splitSentences(paragraph);
    if (sentences.length < 2) return [paragraph];
    const blocks = [];
    let current = [];
    for (const sentence of sentences) {
      current.push(sentence);
      if (wordCount(current.join(' ')) >= target) {
        blocks.push(current.join(' '));
        current = [];
      }
    }
    if (current.length) {
      // A last block of one short sentence joins the previous one
      if (blocks.length && wordCount(current.join(' ')) < target / 2) blocks[blocks.length - 1] += ` ${current.join(' ')}`;
      else blocks.push(current.join(' '));
    }
    return blocks;
  });
};

/** Words that only a filler story uses: the model talking about the JSON instead of telling a story. */
const PLACEHOLDER_RE = /\b(?:jour|histoire|titre|texte|contenu)s?\s+(?:fictif|fictive|temporaire|factice|vide)s?\b|respecter la structure|structure (?:du|de la r[ée]ponse) json|placeholder|lorem ipsum|\bnon utilis[ée]e?\b/i;
/**
 * Share of identical sentences above which a text is a filler (the real filler repeated one sentence only;
 * a story with a refrain stays well below).
 */
const REPEATED_SENTENCES_SHARE = 0.6;

/**
 * Whether a story is a filler written to reach the number of stories required by the JSON schema
 * ("Titre temporaire non utilisé" / "Ceci est un jour fictif pour respecter la structure du JSON." x5).
 * @param {{title?: string, paragraphs: string[]}} story
 */
export const isPlaceholderStory = ({ title = '', paragraphs = [] }) => {
  const text = paragraphs.join(' ');
  if (PLACEHOLDER_RE.test(title) || PLACEHOLDER_RE.test(text)) return true;
  const sentences = splitSentences(text).map(comparable);
  if (sentences.length < 3) return false;
  const counts = new Map();
  sentences.forEach(sentence => counts.set(sentence, (counts.get(sentence) || 0) + 1));
  return Math.max(...counts.values()) / sentences.length > REPEATED_SENTENCES_SHARE;
};

/**
 * Removes the sentences of the previous day's ending that the model copied at the start of the new story.
 * @param {string[]} paragraphs - Paragraphs of the new story.
 * @param {string} previousEnding - Last paragraph of the previous day.
 * @returns {{paragraphs: string[], removed: number}} Cleaned paragraphs and the number of sentences removed.
 */
export const removeRepeatedOpening = (paragraphs, previousEnding) => {
  const known = new Set(splitSentences(previousEnding).map(comparable).filter(Boolean));
  if (known.size === 0 || !Array.isArray(paragraphs) || paragraphs.length === 0) return { paragraphs, removed: 0 };

  const result = [...paragraphs];
  let removed = 0;
  let removedLength = 0;
  while (result.length > 0) {
    const sentences = splitSentences(result[0]);
    let index = 0;
    while (index < sentences.length && known.has(comparable(sentences[index]))) {
      removedLength += comparable(sentences[index]).length;
      index++;
    }
    if (index === 0) break;
    removed += index;
    const rest = sentences.slice(index).join(' ').trim();
    if (rest) {
      result[0] = rest;
      break;
    }
    result.shift(); // the whole paragraph was copied: check the next one
  }
  // A short exclamation in common ("Oh !") is not a copied opening
  if (removed === 0 || removedLength < MIN_REPEATED_LENGTH || result.length === 0) return { paragraphs, removed: 0 };
  return { paragraphs: result, removed };
};

/**
 * Parses and normalizes a structured story answer.
 * @param {string} text - Raw model answer.
 * @returns {Array<{day: string|null, title: string, summary: string, themes: Object[], paragraphs: string[], illustrationPrompt: string}>|null}
 *   Normalized stories, or null when the answer is not usable JSON (caller falls back to the text parser).
 */
export const parseStoryOutput = (text) => {
  const json = extractJson(text);
  if (!json) return null;

  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return null;
  }

  let rawStories;
  if (Array.isArray(data)) rawStories = data;
  else if (Array.isArray(data?.stories)) rawStories = data.stories;
  else if (data?.stories && typeof data.stories === 'object') rawStories = [data.stories];
  else if (data && typeof data === 'object' && (data.title || data.paragraphs)) rawStories = [data];
  else return null;

  const stories = rawStories
    .filter(story => story && typeof story === 'object')
    .map(story => {
      const illustrationPrompt = asText(story.illustration_prompt) || asText(story.illustrationPrompt);
      const { paragraphs, removed } = cleanStoryParagraphs(normalizeParagraphs(story), illustrationPrompt);
      return {
        day: PromptHelper.normalizeDay(story.day),
        title: asText(story.title),
        summary: asText(story.summary),
        themes: normalizeThemes(story.themes),
        paragraphs,
        illustrationPrompt,
        cleanedParagraphs: removed
      };
    })
    // A filler story counts as missing: the week is incomplete and the missing day is asked again
    .filter(story => story.paragraphs.length > 0 && !isPlaceholderStory(story));

  return stories.length > 0 ? stories : null;
};
