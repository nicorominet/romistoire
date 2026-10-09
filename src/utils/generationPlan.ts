import { ALL_WEEK } from "@/constants";

/**
 * Free tier of the Gemini Flash models: 5 requests per minute. Calls to the cloud provider start
 * at least 12 s apart; a call that lasted longer than that costs no extra wait.
 */
export const GENERATION_MIN_INTERVAL_MS = 12000;

/** Ages whose whole week fits one request (short stories: a week is about 1,000 to 5,000 words). */
export const SINGLE_CALL_AGES = ["2-3", "4-6", "7-9"];

/**
 * Whether a whole week is generated day by day (7 requests) rather than in one request.
 * - Young ages, cloud provider: one request (7 times fewer requests, short stories are not compressed).
 * - From 10-12, or with Ollama (small local models): day by day, each day continuing the previous one,
 *   which keeps the length asked for long stories.
 */
export const isIterativeGeneration = (dayOfWeek: string, age?: string, provider?: string) =>
  dayOfWeek === ALL_WEEK && (provider === "local" || !SINGLE_CALL_AGES.includes(String(age ?? "").replace(/\s*ans\s*$/i, "")));

/** Stories of a week. */
export const WEEK_STORY_COUNT = 7;

/**
 * Stories missing from a week generated in one request (none for a single day).
 * @param dayOfWeek - Requested day, or ALL_WEEK.
 * @param received - Stories found in the answer (saved, failed or skipped).
 */
export const missingWeekStories = (dayOfWeek: string, received: number) =>
  dayOfWeek === ALL_WEEK ? Math.max(0, WEEK_STORY_COUNT - received) : 0;

/** Wait before the next request, given when the previous one started (null: no previous request). */
export const pacingDelay = (previousStart: number | null, now: number, minInterval = GENERATION_MIN_INTERVAL_MS) =>
  previousStart === null ? 0 : Math.max(0, minInterval - (now - previousStart));

/** Words of a story text (HTML tags ignored). */
export const countWords = (html: string) =>
  html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

/** Characters kept from the last scene of a day, picked up by the next day. */
export const STORY_ENDING_MAX = 800;

/** A day already written this week, as given to the next days. */
export interface WrittenDay {
  day: string;
  title: string;
  summary: string;
  /** Last paragraph, plain text */
  ending: string;
  /** First sentence, plain text */
  opening?: string;
}

/** A character sheet written by the first day of the week. */
export interface CharacterSheet {
  name: string;
  description: string;
}

/** What a week generated day by day knows so far. */
export interface WeekContext {
  weekPlan: string[] | null;
  characters: CharacterSheet[] | null;
  days: WrittenDay[];
}

export const emptyWeekContext = (): WeekContext => ({ weekPlan: null, characters: null, days: [] });

const decodeEntities = (text: string) => text
  .replace(/&nbsp;/g, " ")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, "&");

/** Paragraphs of a story (editor HTML or plain text), as plain text. */
const plainParagraphs = (content: string) => {
  const paragraphs = content.includes("<")
    ? (content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [content])
    : content.split(/\n\s*\n/);
  return paragraphs
    .map(paragraph => decodeEntities(paragraph.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

/** Last paragraph of a story (editor HTML or plain text), as plain text. */
export const storyEnding = (content: string, max = STORY_ENDING_MAX) => {
  const plain = plainParagraphs(content);
  const last = plain[plain.length - 1] || "";
  return last.length > max ? `…${last.slice(-max)}` : last;
};

/** Characters kept from the opening sentence of a day, shown to the next days so they open differently. */
export const STORY_OPENING_MAX = 160;

/** First sentence of a story, as plain text. */
export const storyOpening = (content: string, max = STORY_OPENING_MAX) => {
  const first = plainParagraphs(content)[0] || "";
  // A sentence ends before a capital letter, a quote or a dash ("« Regarde ! » cria Léo." is one sentence)
  const sentence = first.match(/^.+?[.!?…](?:\s*»)?(?=\s+[A-ZÀ-ÖØ-Þ«—–-]|\s*$)/)?.[0] ?? first;
  return sentence.length > max ? `${sentence.slice(0, max)}…` : sentence;
};

/**
 * Continuity parameters of the next day: the plan of the week, the character sheets,
 * every day already written (title and summary) and the last scene of the previous day.
 */
export const buildDayParams = (context: WeekContext) => {
  const previous = context.days[context.days.length - 1];
  return {
    weekSeries: true as const,
    weekPlan: context.weekPlan ?? undefined,
    characters: context.characters ?? undefined,
    previousDays: context.days.map(({ day, title, summary, opening }) => ({ day, title, summary, ...(opening ? { opening } : {}) })),
    previousEnding: previous?.ending || undefined,
    // Older servers only read the summary of the previous day
    previousSummary: previous?.summary || undefined,
  };
};

/** A story is flagged as short below half of the minimum length asked for its age. */
export const isShortStory = (words: number, target?: { min: number; max: number } | null) =>
  Boolean(target && target.min > 0 && words < target.min / 2);
