import { query, getConnection } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { themeService } from './theme.service.js';
import { storyVersionService } from './story_version.service.js';
import { storyQueryHelper } from './story_query.helper.js';
import { storySeriesHelper } from './story_series.helper.js';
import { geminiService } from './gemini.service.js';
import { localLLMService } from './local_llm.service.js';
import { defaultProvider } from './settings.service.js';
import { fileCleanup, AUDIO_DIR } from './helpers/file_cleanup.helper.js';
import { assignWeekDays, countRepetitiveOpenings, extractWeekContext, parseStoryOutput, removeRepeatedOpening, splitParagraphsForAge } from './helpers/story_output.helper.js';
import { ALL_WEEK, FORBIDDEN_OPENINGS, PromptHelper } from './helpers/prompt.helper.js';
import { STORY_DAYS } from './helpers/story_schema.js';
import { SHORT_STORY_RATIO } from './helpers/generation_plan.helper.js';
import { logger } from './logger.service.js';
import { NotFoundError, ValidationError } from '../middleware/error.middleware.js';

// A single story (or a week whose median story) under SHORT_STORY_RATIO of the minimum length of its age
// is asked once more (one more request at most).

const AGE_GROUPS = ['2-3', '4-6', '7-9', '10-12', '13-15', '16-18'];
const LOCALES = ['fr', 'en'];
const TITLE_MAX = 255;
const DAY_ORDERS = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

/** Text of a story content without its HTML ("<p></p>" is empty). */
const plainText = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();

/**
 * Checks a story payload (camelCase or snake_case fields, as sent by the pages and the generation worker).
 * @param {Object} data
 * @param {{partial?: boolean}} [options] - partial: only the fields present are checked (update).
 * @throws {ValidationError} With every invalid field ({ fields }).
 */
export const validateStoryInput = (data = {}, { partial = false } = {}) => {
  const errors = [];
  const check = (present, valid, message) => {
    if ((present || !partial) && !valid) errors.push(message);
  };
  const title = data.title;
  check(title !== undefined, typeof title === 'string' && title.trim() !== '' && title.trim().length <= TITLE_MAX, `title is required (${TITLE_MAX} characters max)`);
  check(data.content !== undefined, plainText(data.content) !== '', 'content must contain text');

  const age = data.ageGroup ?? data.age_group;
  check(age !== undefined, AGE_GROUPS.includes(age), `ageGroup must be one of ${AGE_GROUPS.join(', ')}`);

  const week = data.weekNumber ?? data.week_number;
  check(week !== undefined, Number.isInteger(Number(week)) && Number(week) >= 1 && Number(week) <= 53, 'weekNumber must be between 1 and 53');

  // The day is optional (defaults to Monday on creation)
  const day = data.day_order ?? (data.dayOfWeek !== undefined ? (DAY_ORDERS[data.dayOfWeek] ?? 0) : undefined);
  if (day !== undefined && !(Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= 7)) {
    errors.push('day must be a day of the week');
  }
  if (data.locale !== undefined && !LOCALES.includes(data.locale)) errors.push(`locale must be one of ${LOCALES.join(', ')}`);

  if (errors.length > 0) throw new ValidationError('Invalid story', { fields: errors });
};

/**
 * Whether a second answer is better than the first: more complete first (up to the expected number of stories),
 * then longer (typical length).
 */
const isBetterAnswer = (candidateWords, currentWords, expectedStories) => {
  const complete = (words) => Math.min(words.length, expectedStories);
  if (complete(candidateWords) !== complete(currentWords)) return complete(candidateWords) > complete(currentWords);
  return typicalLength(candidateWords) > typicalLength(currentWords);
};

/** Length of an answer: the word count of a single story, the median of several. */
const typicalLength = (words) => {
  if (words.length === 0) return 0;
  const sorted = [...words].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

/**
 * Turns stored story content (plain text, markdown or editor HTML) into text fit for speech.
 * Illustration descriptions, HTML tags and markdown markers are never read aloud.
 * @param {string} content - Story content.
 * @returns {string} Text to read.
 */
export const buildSpeechText = (content) => (content || '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, '\n') // Block ends become line breaks
    .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\[\s*(?:Illustration|Description)[^\]]*\]/gis, '') // Remove [Illustration: ...] tags
    .replace(/^[ \t]*>?[ \t]*\**[ \t]*(?:Illustration(?:[ \t]+sugg[ée]r[ée]e)?|Description de l['’]illustration)[ \t]*\**[ \t]*:.*$/gim, '') // Labelled illustration lines
    .replace(/^[ \t]*🎨.*$/gm, '')
    .replace(/\*\*/g, '') // Remove bold markdown
    .replace(/^[ \t]*#+[ \t]*/gm, '') // Remove markdown headings
    .replace(/\n\s*\n/g, '\n\n') // Fix spacing
    .trim();

/**
 * Cleans the themes sent for a story: ids or { id, isPrimary } objects, duplicates removed,
 * exactly one primary theme (the first one when none is marked).
 * @param {Array<string|{id: string, isPrimary?: boolean}>} themes
 * @returns {Array<{id: string, isPrimary: boolean}>}
 */
export const normalizeStoryThemes = (themes) => {
  const seen = new Set();
  const cleaned = [];
  for (const theme of Array.isArray(themes) ? themes : []) {
    const id = typeof theme === 'string' ? theme : theme?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    cleaned.push({ id, isPrimary: typeof theme === 'object' && (theme.isPrimary === true || Number(theme.isPrimary ?? theme.is_primary) === 1) });
  }
  const primaryIndex = Math.max(0, cleaned.findIndex(theme => theme.isPrimary));
  return cleaned.map((theme, index) => ({ ...theme, isPrimary: cleaned.length > 0 && index === primaryIndex }));
};

/**
 * Service for managing stories and related data.
 * Coordinates between database and specialized helpers/services.
 */
class StoryService {
  // ... existing methods ...

  /**
   * Generate a story using AI (Gemini or Local).
   * @param {Object} params - Prompt parameters (see PromptHelper.buildStoryPrompt).
   * @param {'gemini'|'local'|null} [providerOverride]
   * @param {{beforeRequest?: () => Promise<void>}} [options] - beforeRequest: awaited before every AI request
   *   (the length retry included), e.g. the pacing of a mass generation.
   * @returns {Promise<{text: string, model: string, truncated: boolean, stories: Object[]|null}>}
   *   `stories` holds the parsed JSON answer, or null when the client must fall back to the text parser.
   */
  async generateFromAI(params, providerOverride = null, { beforeRequest } = {}) {
      const aiProvider = providerOverride || defaultProvider();
      
      console.log(`[StoryService] Generating story using provider: ${aiProvider}`);
      
      // The model reuses the library's themes instead of inventing near-duplicates
      const existingThemes = (await themeService.findAll({ sort: 'usage' })).map(theme => theme.name);
      const promptParams = { ...params, existingThemes };
      const targetWords = PromptHelper.getTargetWords(params.age);

      const isWeek = params.day === ALL_WEEK;
      const expectedStories = isWeek ? STORY_DAYS.length : 1;

      if (beforeRequest) await beforeRequest();
      let attempt = await this._generateOnce(aiProvider, promptParams);

      // Ask once more when the answer is incomplete (a week with fewer than 7 stories) or far below the length
      // of its age (small models), and keep the better answer: the most complete, then the longest.
      let lengthRetry = null;
      const firstWords = typicalLength(attempt.words);
      const firstCount = attempt.words.length;
      const incompleteFirst = firstCount > 0 && firstCount < expectedStories;
      const shortFirst = firstCount > 0 && targetWords.min > 0 && firstWords < targetWords.min * SHORT_STORY_RATIO;
      if (incompleteFirst || shortFirst) {
        const hints = [];
        if (incompleteFirst) {
          hints.push(`Votre réponse ne contenait que ${firstCount} histoire(s) : écrivez les ${expectedStories} histoires, une par jour du lundi au dimanche.`);
        }
        if (shortFirst) {
          hints.push(isWeek
            ? `Vos histoires faisaient environ ${firstWords} mots chacune : écrivez au moins ${targetWords.min} mots pour chacune des ${expectedStories} histoires, en développant les scènes, les dialogues et les sensations.`
            : `Votre précédente version faisait ${firstWords} mots : écrivez au moins ${targetWords.min} mots, en développant les scènes, les dialogues et les sensations.`);
        }
        try {
          if (beforeRequest) await beforeRequest();
          const retry = await this._generateOnce(aiProvider, { ...promptParams, lengthHint: hints.join(' ') });
          lengthRetry = { before: firstWords, after: typicalLength(retry.words), storiesBefore: firstCount, storiesAfter: retry.words.length };
          if (isBetterAnswer(retry.words, attempt.words, expectedStories)) {
            attempt = {
              ...retry,
              weekPlan: retry.weekPlan ?? attempt.weekPlan,
              characters: retry.characters ?? attempt.characters
            };
          }
        } catch (error) {
          // The first version is still usable
          lengthRetry = { before: firstWords, after: null, error: error.message };
        }
      }

      const { result, stories, words, repeatedOpeningRemoved, cleanedParagraphs, weekPlan, characters, daysFixed } = attempt;
      const incomplete = words.length > 0 && words.length < expectedStories ? { stories: words.length, expected: expectedStories } : null;

      // Length and continuity context, so short or disconnected stories show up in the AI log
      logger.ai(aiProvider === 'local' ? 'Ollama' : 'Gemini', 'Story-Parsed',
        {
          age: params.age, day: params.day, weekSeries: Boolean(params.weekSeries),
          previousDays: Array.isArray(params.previousDays) ? params.previousDays.length : 0,
          previousEnding: Boolean(params.previousEnding), weekPlanGiven: Array.isArray(params.weekPlan) && params.weekPlan.length > 0,
          charactersGiven: Array.isArray(params.characters) ? params.characters.length : 0
        },
        {
          model: result.model, finishReason: result.finishReason, parsed: Boolean(stories), stories: words.length, words, targetWords,
          repeatedOpeningRemoved, cleanedParagraphs, lengthRetry, incomplete, daysFixed, weekPlan, characters,
          // Stories opening with "Hier…" or the same words as another day: measures the opening rule
          repetitiveOpenings: countRepetitiveOpenings(stories || [], FORBIDDEN_OPENINGS)
        });

      return { ...result, stories, targetWords, weekPlan, characters };
  }

  /**
   * One generation request: parsed stories (opening copied from the previous day removed),
   * their word counts, and the week context written by the first day.
   * @private
   */
  async _generateOnce(aiProvider, promptParams) {
      const result = aiProvider === 'local'
          ? await localLLMService.generateStory(promptParams)
          : await geminiService.generateStory(promptParams);

      let stories = parseStoryOutput(result.text);
      if (!stories) console.warn('[StoryService] AI answer is not valid JSON, client will use the text parser.');

      // A whole week: one story per day (a repeated or missing day is fixed by position)
      let daysFixed = 0;
      if (stories && promptParams.day === ALL_WEEK) {
        ({ stories, fixed: daysFixed } = assignWeekDays(stories));
      }

      // Models sometimes open the new day by copying the end of the previous one:
      // the ending sent for a day generated day by day, or the previous story of a whole week
      let repeatedOpeningRemoved = 0;
      if (stories) {
        const original = stories;
        stories = original.map((story, index) => {
          const previous = index > 0 ? original[index - 1] : null;
          const ending = previous ? previous.paragraphs[previous.paragraphs.length - 1] : promptParams.previousEnding;
          if (!ending) return story;
          const { paragraphs, removed } = removeRepeatedOpening(story.paragraphs, ending);
          repeatedOpeningRemoved += removed;
          return { ...story, paragraphs };
        });
      }

      // Paragraphs sized for the age group (no change to the text)
      if (stories) stories = stories.map(story => ({ ...story, paragraphs: splitParagraphsForAge(story.paragraphs, promptParams.age) }));

      // First day of a week generated day by day: the plan and the characters the following days will follow
      const { weekPlan, characters } = extractWeekContext(result.text);
      const words = (stories || []).map(story => story.paragraphs.join(' ').split(/\s+/).filter(Boolean).length);
      // Filler and illustration paragraphs removed by parseStoryOutput
      const cleanedParagraphs = (stories || []).reduce((total, story) => total + (story.cleanedParagraphs || 0), 0);
      return { result, stories, words, repeatedOpeningRemoved, cleanedParagraphs, daysFixed, weekPlan, characters };
  }

  /**
   * Get available models from local LLM provider (Ollama).
   */
  async getOllamaModels() {
      return await localLLMService.listModels();
  }

  /**
   * Generate audio for a story, save it, and update the record.
   */
  async generateAudioForStory(id) {
    const story = await this.findById(id);
    if (!story) throw new Error('Story not found');
    if (!story.content) throw new Error('Story content is empty');

    const contentToRead = buildSpeechText(story.content);
    if (!contentToRead) throw new Error('Story content is empty');

    console.log(`[StoryService] Generating audio for story ${id}...`);
    const { audioBuffer, extension } = await geminiService.generateAudio(contentToRead);

    // Stored under uploads/audio: served by Express (/uploads) in production and by Vite in dev
    if (!fs.existsSync(AUDIO_DIR)) {
        fs.mkdirSync(AUDIO_DIR, { recursive: true });
    }

    // Timestamp in the name so a regenerated file is never served from the browser cache
    const fileName = `${id}_v${story.version || 1}_${Date.now()}.${extension || 'wav'}`;
    fs.writeFileSync(path.join(AUDIO_DIR, fileName), audioBuffer);
    const publicUrl = `/uploads/audio/${fileName}`;

    // Update story, then drop the previous file
    await this.saveAudioPath(id, publicUrl);
    await fileCleanup.removeAudioIfUnused(story.audio_path);

    return publicUrl;
  }

  /**
   * Find all stories with pagination and filtering.
   */
  async findAll(params) {
// ... rest of findAll
    const { page = 1, limit = 12 } = params;
    const offset = (page - 1) * limit;

    const { whereClause, params: queryParams } = storyQueryHelper.buildWhere(params);

    const dataQueryPromise = (async () => {
        const queryStr = `
            SELECT s.*, ss.name as series_name
            FROM stories s
            LEFT JOIN story_series ss ON s.series_id = ss.id
            WHERE ${whereClause}
            ORDER BY s.day_order ASC, s.created_at ASC LIMIT ? OFFSET ?
        `;
        const stories = await query(queryStr, [...queryParams, String(limit), String(offset)]);
        return await this._hydrateStories(stories);
    })();

    const countQueryPromise = (async () => {
        const countQueryStr = `SELECT COUNT(*) as total FROM stories s WHERE ${whereClause}`;
        const result = await query(countQueryStr, queryParams);
        return result[0].total;
    })();

    const [mappedStories, total] = await Promise.all([dataQueryPromise, countQueryPromise]);
    
    return { data: mappedStories, total, page, limit };
  }

  /**
   * Get list of week numbers that have available stories.
   */
  async getAvailableWeeks(params) {
    const { whereClause, params: queryParams } = storyQueryHelper.buildWhere(params);
    const queryStr = `SELECT DISTINCT s.week_number FROM stories s WHERE ${whereClause} ORDER BY s.week_number ASC`;
    const result = await query(queryStr, queryParams);
    return result.map(row => row.week_number);
  }

  /**
   * Find multiple stories by their IDs.
   */
  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const stories = await query(
      `SELECT id, title, content, age_group as ageGroup, week_number as weekNumber, day_order as dayOrder, created_at as createdAt, modified_at as modifiedAt, version, locale 
       FROM stories 
       WHERE id IN (${placeholders})`,
      ids
    );

    return await Promise.all(stories.map(s => this.findById(s.id)));
  }

  /**
   * Find a single story by ID.
   */
  async findById(id) {
    const storyResult = await query(`
      SELECT s.*, ss.name as series_name
      FROM stories s
      LEFT JOIN story_series ss ON s.series_id = ss.id
      WHERE s.id = ?
    `, [id]);
  
    if (storyResult.length === 0) return null;
    const story = storyResult[0];

    // Themes
    const themesResult = await query(`
      SELECT t.id, t.name, t.description, t.color, t.icon, t.created_at, st.is_primary
      FROM themes t
      INNER JOIN story_themes st ON t.id = st.theme_id
      WHERE st.story_id = ?
      ORDER BY st.is_primary DESC, t.name ASC
    `, [id]);
  
    story.themes = themesResult.map(({ is_primary, ...theme }) => ({
      ...theme,
      isPrimary: Number(is_primary) === 1,
      createdAt: theme.created_at
    }));

    // Illustrations
    story.illustrations = await this.getIllustrations(id);
    return story;
  }

  /**
   * Create a new story.
   */
  async create(storyData) {
    validateStoryInput(storyData);
    const connection = await getConnection();
    try {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const id = uuidv4();
      
      const dayOrder = storyData.day_order ?? this._mapDayToOrder(storyData.dayOfWeek) ?? 1;

      await connection.beginTransaction();

      // Resolve Series
      let seriesId = await storySeriesHelper.resolveSeriesId(connection, storyData.seriesId || storyData.series_id, storyData.seriesName || storyData.series_name);
      
      // Handle Collisions & Branching
      const slot = await storySeriesHelper.resolveSlot(connection, {
        weekNumber: storyData.weekNumber || storyData.week_number,
        dayOrder,
        ageGroup: storyData.ageGroup || storyData.age_group,
        locale: storyData.locale,
        seriesId
      }, storyData.seriesName || storyData.series_name);
      seriesId = slot.seriesId;

      // Insert Story
      const source = storyData.source || 'manual';
      // AI stories wait for a human review (indicative status); manual ones are reviewed by definition
      const reviewStatus = ['to_review', 'validated'].includes(storyData.reviewStatus)
        ? storyData.reviewStatus
        : (source === 'manual' ? 'validated' : 'to_review');
      await connection.query(
        `INSERT INTO stories (id, title, content, age_group, week_number, day_order, created_at, modified_at, version, locale, source, is_manually_edited, series_id, illustration_prompt, generation_job_id, review_status, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, storyData.title.trim(), storyData.content, storyData.ageGroup || storyData.age_group, storyData.weekNumber || storyData.week_number, dayOrder, now, now, 1, storyData.locale || 'fr', source, false, seriesId, storyData.illustrationPrompt ?? storyData.illustration_prompt ?? null, storyData.generationJobId ?? null, reviewStatus, storyData.summary ? String(storyData.summary).trim() : null]
      );

      // Link Themes
      for (const theme of normalizeStoryThemes(storyData.themes)) {
          await connection.query(
            `INSERT INTO story_themes (id, story_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), id, theme.id, theme.isPrimary, now]
          );
      }

      // Link Illustrations
      if (storyData.illustrations?.length) {
        for (const illu of storyData.illustrations) {
          await connection.query(
            `INSERT INTO illustrations (id, story_id, image_path, filename, file_type, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), id, illu.image_path || illu.imagePath || illu.path || null, illu.filename, illu.fileType || illu.file_type || null, now, illu.position || 0]
          );
        }
      }

      await connection.commit();
      themeService.invalidateCache();
      return { id, ...storyData, series_id: seriesId, aliasSeries: slot.alias };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Sets the review status (indicative) of one or several stories. Not a content change: no new version.
   * @param {string[]} ids
   * @param {'to_review'|'validated'} status
   * @returns {Promise<number>} Stories updated.
   */
  async setReviewStatus(ids, status) {
    if (!['to_review', 'validated'].includes(status)) throw new ValidationError('Invalid review status');
    const list = (Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id);
    if (list.length === 0) return 0;
    const result = await query(
      `UPDATE stories SET review_status = ? WHERE id IN (${list.map(() => '?').join(',')})`,
      [status, ...list]
    );
    return result?.affectedRows ?? 0;
  }

  /**
   * Update an existing story with versioning.
   */
  async update(id, storyData) {
    validateStoryInput(storyData, { partial: true });
    const connection = await getConnection();
    try {
      const [existing] = await connection.query('SELECT * FROM stories WHERE id = ?', [id]);
      if (existing.length === 0) throw new NotFoundError('Story not found');
      const oldStory = existing[0];
      // Fields not sent keep their value
      const title = storyData.title !== undefined ? storyData.title.trim() : oldStory.title;
      const content = storyData.content !== undefined ? storyData.content : oldStory.content;
      // The audio reads the title and the text: it is kept unless one of them changed
      const textChanged = title !== oldStory.title || content !== oldStory.content;
      
      const [oldThemes] = await connection.query('SELECT * FROM story_themes WHERE story_id = ?', [id]);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await connection.beginTransaction();

      // Delegation: Create SNAPSHOT for versioning
      await storyVersionService.createSnapshot(connection, oldStory, oldThemes);

      // Map day order
      const dayOrder = storyData.day_order ?? (storyData.dayOfWeek ? this._mapDayToOrder(storyData.dayOfWeek) : oldStory.day_order);
      const weekNumber = storyData.weekNumber || storyData.week_number || oldStory.week_number;
      const ageGroup = storyData.ageGroup || storyData.age_group || oldStory.age_group;
      const locale = storyData.locale || oldStory.locale;

      // Resolve Series: only when the payload carries a series field (empty name = remove from series)
      const hasSeriesField = ['seriesId', 'series_id', 'seriesName', 'series_name'].some(key => key in storyData);
      let seriesName = storyData.seriesName ?? storyData.series_name ?? null;
      let seriesId = hasSeriesField
        ? await storySeriesHelper.resolveSeriesId(connection, storyData.seriesId || storyData.series_id, seriesName)
        : oldStory.series_id;

      // Handle Collisions & Branching when the story moves to another slot
      let aliasSeries = null;
      const slotChanged = Number(weekNumber) !== Number(oldStory.week_number)
        || Number(dayOrder) !== Number(oldStory.day_order)
        || ageGroup !== oldStory.age_group
        || locale !== oldStory.locale
        || (seriesId || null) !== (oldStory.series_id || null);

      if (slotChanged) {
        if (!seriesName && seriesId) {
          const [seriesRows] = await connection.query('SELECT name FROM story_series WHERE id = ?', [seriesId]);
          seriesName = seriesRows[0]?.name || null;
        }
        const slot = await storySeriesHelper.resolveSlot(connection, {
          weekNumber,
          dayOrder,
          ageGroup,
          locale,
          seriesId,
          excludeStoryId: id
        }, seriesName);
        seriesId = slot.seriesId;
        aliasSeries = slot.alias;
      }

      // Update Main Record
      const isCurrentlyManual = oldStory.source === 'manual';
      
      // Calculate NEXT linear version (Max + 1) to avoid collision/rewind
      const nextVersion = await storyVersionService.getNextVersionNumber(id);

      // Illustration prompt is only changed when explicitly sent
      const hasIllustrationPrompt = 'illustrationPrompt' in storyData || 'illustration_prompt' in storyData;
      const illustrationPrompt = hasIllustrationPrompt
        ? (storyData.illustrationPrompt ?? storyData.illustration_prompt ?? null)
        : (oldStory.illustration_prompt ?? null);

      // Saved from the edit page: a person read the story, so it counts as reviewed
      await connection.query(
           `UPDATE stories SET title = ?, content = ?, age_group = ?, week_number = ?, day_order = ?, modified_at = ?, locale = ?, version = ?, is_manually_edited = ?, series_id = ?, illustration_prompt = ?, review_status = 'validated', audio_path = ? WHERE id = ?`,
           [title, content, ageGroup, weekNumber, dayOrder, now, locale, nextVersion, !isCurrentlyManual, seriesId, illustrationPrompt, textChanged ? null : oldStory.audio_path, id]
      );

      // Refresh Themes (only when sent: a partial update keeps them)
      if (Array.isArray(storyData.themes)) {
        await connection.query('DELETE FROM story_themes WHERE story_id = ?', [id]);
        for (const theme of normalizeStoryThemes(storyData.themes)) {
            await connection.query(
                'INSERT INTO story_themes (id, story_id, theme_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), id, theme.id, theme.isPrimary, now]
            );
        }
      }

      // Refresh Illustrations
      // Note: We assume full replacement if illustrations are provided.
      // If illustrations is undefined, we might skip, but consistent PUT usually implies replacement.
      // However, to be safe and match `create`, we check for existence.
      // If the frontend sends existing illustrations, they should be in the list.
      if (storyData.illustrations) {
          await connection.query('DELETE FROM illustrations WHERE story_id = ?', [id]);
          for (const illu of storyData.illustrations) {
              await connection.query(
                `INSERT INTO illustrations (id, story_id, image_path, filename, file_type, created_at, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), id, illu.image_path || illu.imagePath || illu.path || null, illu.filename, illu.fileType || illu.file_type || null, now, illu.position || 0]
              );
          }
      }

      await connection.commit();
      themeService.invalidateCache();
      // A new text makes the audio wrong: delete the old file
      if (textChanged) await fileCleanup.removeAudioIfUnused(oldStory.audio_path);
      return { id, ...storyData, title, content, series_id: seriesId, modified_at: now, review_status: 'validated', audio_path: textChanged ? null : oldStory.audio_path, aliasSeries };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete a story.
   */
  async delete(id) {
    const [story] = await query('SELECT audio_path FROM stories WHERE id = ?', [id]);
    const illustrations = await query('SELECT image_path FROM illustrations WHERE story_id = ?', [id]);

    await query('DELETE FROM stories WHERE id = ?', [id]); // Illustrations cascade
    themeService.invalidateCache();

    // Files go once no other row references them
    for (const illustration of illustrations) {
      await fileCleanup.removeImageIfUnused(illustration.image_path);
    }
    await fileCleanup.removeAudioIfUnused(story?.audio_path);
    return true;
  }

  // --- Delegation Methods ---
  
  async getVersions(id) { return storyVersionService.getVersions(id); }
  async restoreVersion(id, versionId) { return storyVersionService.restoreVersion(id, versionId); }
  
  // --- Legacy/Small Helpers ---

  async getIllustrations(storyId) {
      return await query(
          'SELECT id, story_id as storyId, image_path, filename, file_type as fileType, position, created_at as createdAt FROM illustrations WHERE story_id = ? ORDER BY position ASC',
          [storyId]
      );
  }

  async deleteIllustration(storyId, illustrationId) {
       const rows = await query('SELECT image_path FROM illustrations WHERE id = ? AND story_id = ?', [illustrationId, storyId]);
       if (rows.length === 0) return null;
       await query('DELETE FROM illustrations WHERE id = ? AND story_id = ?', [illustrationId, storyId]);
       themeService.invalidateCache();
       await fileCleanup.removeImageIfUnused(rows[0].image_path);
       return rows[0].image_path;
  }

  /**
   * Rewrites illustration positions (0..n-1) following the given order.
   * The list must contain exactly the story's illustrations.
   * @param {string} storyId - Story ID.
   * @param {string[]} orderedIds - Illustration IDs in the new order.
   * @returns {Promise<Array>} Illustrations in their new order.
   */
  async reorderIllustrations(storyId, orderedIds) {
      const connection = await getConnection();
      try {
          const [rows] = await connection.query('SELECT id FROM illustrations WHERE story_id = ?', [storyId]);
          const existingIds = rows.map(row => row.id);
          const sameSet = orderedIds.length === existingIds.length
            && new Set(orderedIds).size === orderedIds.length
            && orderedIds.every(id => existingIds.includes(id));
          if (!sameSet) throw new Error('Illustration list mismatch');

          await connection.beginTransaction();
          for (const [position, illustrationId] of orderedIds.entries()) {
              await connection.query('UPDATE illustrations SET position = ? WHERE id = ? AND story_id = ?', [position, illustrationId, storyId]);
          }
          await connection.commit();
      } catch (error) {
          await connection.rollback();
          throw error;
      } finally {
          connection.release();
      }
      themeService.invalidateCache();
      return this.getIllustrations(storyId);
  }

  async saveAudioPath(storyId, audioPath) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query('UPDATE stories SET audio_path = ?, modified_at = ? WHERE id = ?', [audioPath, now, storyId]);
      themeService.invalidateCache();
  }

  /**
   * Previous / next story in reading order: same age group, language and series,
   * ordered by (week, day) so Sunday leads to the next week's Monday.
   */
  async getNeighbors(id) {
     const story = await query(`SELECT week_number, day_order, age_group, locale, series_id FROM stories WHERE id = ?`, [id]);
     if (story.length === 0) return { next: null, prev: null };
     const { week_number, day_order, age_group, locale, series_id } = story[0];

     const seriesClause = series_id ? 'series_id = ?' : 'series_id IS NULL';
     const baseParams = series_id ? [age_group, locale, series_id] : [age_group, locale];
     const base = `SELECT id, title FROM stories WHERE age_group = ? AND locale = ? AND ${seriesClause} AND id <> ?`;

     const nextR = await query(
         `${base} AND (week_number > ? OR (week_number = ? AND day_order > ?)) ORDER BY week_number ASC, day_order ASC LIMIT 1`,
         [...baseParams, id, week_number, week_number, day_order]
     );
     const prevR = await query(
         `${base} AND (week_number < ? OR (week_number = ? AND day_order < ?)) ORDER BY week_number DESC, day_order DESC LIMIT 1`,
         [...baseParams, id, week_number, week_number, day_order]
     );
     return { next: nextR[0] || null, prev: prevR[0] || null };
  }

  // --- Private Helpers ---

  async _hydrateStories(stories) {
    if (stories.length === 0) return [];
    
    // One query per relation for the whole page (no N+1, no GROUP_CONCAT splitting on commas)
    const storyIds = stories.map(s => s.id);
    const placeholders = storyIds.map(() => '?').join(',');
    const [allIllu, allThemes] = await Promise.all([
        query(
            `SELECT id, story_id, image_path, filename, file_type, position FROM illustrations WHERE story_id IN (${placeholders}) ORDER BY story_id, position ASC`,
            storyIds
        ),
        query(
            `SELECT st.story_id, st.is_primary, t.id, t.name, t.description, t.color, t.icon
             FROM story_themes st INNER JOIN themes t ON st.theme_id = t.id
             WHERE st.story_id IN (${placeholders}) ORDER BY st.is_primary DESC, t.name ASC`,
            storyIds
        )
    ]);

    return stories.map((story) => {
        const themes = allThemes
            .filter(theme => theme.story_id === story.id)
            .map(({ story_id, is_primary, ...theme }) => ({ ...theme, isPrimary: Number(is_primary) === 1 }));
        const illustrations = allIllu.filter(img => img.story_id === story.id);
        return { ...story, themes, illustrations };
    });
  }

  _mapDayToOrder(day) {
    return { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 }[day] || null;
  }
}

export const storyService = new StoryService();
