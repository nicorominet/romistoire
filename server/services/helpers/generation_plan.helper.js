import { ALL_WEEK } from './prompt.helper.js';

/**
 * How a mass generation is split and paced, and what a week generated day by day remembers.
 * (Moved from the client, src/utils/generationPlan.ts, when generation became a server-side job.)
 */

/**
 * Free tier of the Gemini Flash models: 5 requests per minute. Calls to the cloud provider start
 * at least 12 s apart; a call that lasted longer than that costs no extra wait.
 */
export const GENERATION_MIN_INTERVAL_MS = 12000;

/** Ages whose whole week fits one request (short stories: a week is about 1,000 to 5,000 words). */
// 7-9 is written day by day since the content audit of October 2026: its two weeks written in one request
// were the weakest of the library (stories half as long as asked, generation slips, a plot without thread).
export const SINGLE_CALL_AGES = ['2-3', '4-6'];

/** Days of a week, in order, as sent to the prompt. */
export const GENERATION_DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** French day -> English day stored in the database ("Lundi" -> "Monday"). */
export const DAY_FR_TO_EN = {
  Lundi: 'Monday', Mardi: 'Tuesday', Mercredi: 'Wednesday', Jeudi: 'Thursday',
  Vendredi: 'Friday', Samedi: 'Saturday', Dimanche: 'Sunday'
};

/** Stories of a week. */
export const WEEK_STORY_COUNT = 7;

/**
 * Whether a whole week is generated day by day (7 requests) rather than in one request.
 * - Young ages, cloud provider: one request (7 times fewer requests, short stories are not compressed).
 * - From 10-12, or with Ollama (small local models): day by day, each day continuing the previous one,
 *   which keeps the length asked for long stories.
 */
export const isIterativeGeneration = (dayOfWeek, age, provider) =>
  dayOfWeek === ALL_WEEK && (provider === 'local' || !SINGLE_CALL_AGES.includes(String(age ?? '').replace(/\s*ans\s*$/i, '')));

/** Requests needed for one (week, age) unit. */
export const requestsPerUnit = (dayOfWeek, age, provider) =>
  (isIterativeGeneration(dayOfWeek, age, provider) ? GENERATION_DAYS_FR.length : 1);

/**
 * Stories missing from a week generated in one request (none for a single day).
 * @param {string} dayOfWeek - Requested day, or ALL_WEEK.
 * @param {number} received - Stories found in the answer (saved, failed or skipped).
 */
export const missingWeekStories = (dayOfWeek, received) =>
  (dayOfWeek === ALL_WEEK ? Math.max(0, WEEK_STORY_COUNT - received) : 0);

/** Wait before the next request, given when the previous one started (null: no previous request). */
export const pacingDelay = (previousStart, now, minInterval = GENERATION_MIN_INTERVAL_MS) =>
  (previousStart === null ? 0 : Math.max(0, minInterval - (now - previousStart)));

/** Words of a story text (HTML tags ignored). */
export const countWords = (html) =>
  String(html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

/**
 * Share of the minimum length of its age under which a story is too short: asked once more by the
 * service, reported in the job log. Answers at ~70 % of the minimum were common (generation logs).
 */
export const SHORT_STORY_RATIO = 0.75;

/** Whether a story is too short for its age. */
export const isShortStory = (words, target) => Boolean(target && target.min > 0 && words < target.min * SHORT_STORY_RATIO);

/** Characters kept from the last scene of a day, picked up by the next day. */
export const STORY_ENDING_MAX = 800;
/** Characters kept from the opening sentence of a day, shown to the next days so they open differently. */
export const STORY_OPENING_MAX = 160;

const decodeEntities = (text) => text
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

/** Paragraphs of a story (editor HTML or plain text), as plain text. */
const plainParagraphs = (content) => {
  const text = String(content || '');
  const paragraphs = text.includes('<')
    ? (text.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [text])
    : text.split(/\n\s*\n/);
  return paragraphs
    .map(paragraph => decodeEntities(paragraph.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

/** Last paragraph of a story (editor HTML or plain text), as plain text. */
export const storyEnding = (content, max = STORY_ENDING_MAX) => {
  const plain = plainParagraphs(content);
  const last = plain[plain.length - 1] || '';
  return last.length > max ? `…${last.slice(-max)}` : last;
};

/** First sentence of a story, as plain text. */
export const storyOpening = (content, max = STORY_OPENING_MAX) => {
  const first = plainParagraphs(content)[0] || '';
  // A sentence ends before a capital letter, a quote or a dash ("« Regarde ! » cria Léo." is one sentence)
  const sentence = first.match(/^.+?[.!?…](?:\s*»)?(?=\s+[A-ZÀ-ÖØ-Þ«—–-]|\s*$)/)?.[0] ?? first;
  return sentence.length > max ? `${sentence.slice(0, max)}…` : sentence;
};

/** What a week generated day by day knows so far: plan (from Monday), character sheets, days written. */
export const emptyWeekContext = () => ({ weekPlan: null, characters: null, days: [] });

/**
 * Continuity parameters of the next day: the plan of the week, the character sheets,
 * every day already written (title and summary) and the last scene of the previous day.
 */
export const buildDayParams = (context) => {
  const previous = context.days[context.days.length - 1];
  return {
    weekSeries: true,
    weekPlan: context.weekPlan ?? undefined,
    characters: context.characters ?? undefined,
    previousDays: context.days.map(({ day, title, summary, opening }) => ({ day, title, summary, ...(opening ? { opening } : {}) })),
    previousEnding: previous?.ending || undefined,
    previousSummary: previous?.summary || undefined,
  };
};

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Paragraphs returned by the AI -> editor HTML. */
export const paragraphsToHtml = (paragraphs) => (paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
