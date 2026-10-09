import { query } from '../config/database.js';
import { NotFoundError, ValidationError } from '../middleware/error.middleware.js';
import { storyQueryHelper } from './story_query.helper.js';
import { geminiService } from './gemini.service.js';
import { localLLMService } from './local_llm.service.js';
import {
  imageCode, buildImagePrompt, cleanIllustrationPrompt, buildIllustrationRequest,
  buildPromptsText, buildPromptsJson, ILLUSTRATION_PROMPT_SYSTEM
} from './helpers/image_prompt.helper.js';

const PROMPT_MAX = 2000;

/**
 * Illustration workshop: stories to illustrate, their ready-to-paste prompts, and prompts written by the AI.
 * Images themselves are attached with the usual upload (POST /api/upload with storyId).
 */
class IllustrationService {
  /**
   * Stories to illustrate, in book order (week, age group, series, day).
   * @param {{locale?: string, weekNumber?: string, ageGroup?: string, hasImage?: 'no'|'all'}} filters
   *   hasImage defaults to "no": stories without any illustration.
   * @returns {Promise<Array<Object>>} Rows with code, imagePrompt, illustrationCount and cover (first image path).
   */
  async findTodo({ locale, weekNumber, ageGroup, hasImage = 'no' } = {}) {
    const { whereClause, params } = storyQueryHelper.buildWhere({ locale, weekNumber, ageGroup, hasImage });
    const rows = await query(
      `SELECT s.id, s.title, s.week_number, s.day_order, s.age_group, s.series_id, s.illustration_prompt,
              (SELECT COUNT(*) FROM illustrations i WHERE i.story_id = s.id) AS illustration_count,
              (SELECT i.image_path FROM illustrations i WHERE i.story_id = s.id ORDER BY i.position ASC LIMIT 1) AS cover
       FROM stories s
       WHERE ${whereClause}
       ORDER BY s.week_number ASC, CAST(SUBSTRING_INDEX(s.age_group, '-', 1) AS UNSIGNED) ASC, s.series_id ASC, s.day_order ASC, s.created_at ASC`,
      params
    );
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      week_number: row.week_number === null ? null : Number(row.week_number),
      day_order: Number(row.day_order),
      age_group: row.age_group,
      series_id: row.series_id ?? null,
      illustration_prompt: row.illustration_prompt ?? null,
      code: imageCode(row.id),
      imagePrompt: buildImagePrompt(row),
      illustrationCount: Number(row.illustration_count) || 0,
      cover: row.cover ? String(row.cover).replace(/\\/g, '/') : null
    }));
  }

  /**
   * Prompts file of the filtered stories.
   * @param {Object} filters - Same as findTodo.
   * @param {'txt'|'json'} [format='txt'] - txt to copy by hand, json for the Gemini Canvas tool.
   * @returns {Promise<{body: string, filename: string, type: string}>}
   */
  async exportPrompts(filters, format = 'txt') {
    const items = await this.findTodo(filters);
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      return { body: JSON.stringify(buildPromptsJson(items), null, 2), filename: `prompts-illustrations-${date}.json`, type: 'application/json; charset=utf-8' };
    }
    return { body: buildPromptsText(items), filename: `prompts-illustrations-${date}.txt`, type: 'text/plain; charset=utf-8' };
  }

  async _findStory(storyId) {
    const [story] = await query('SELECT id, title, content, age_group FROM stories WHERE id = ?', [storyId]);
    if (!story) throw new NotFoundError('Story not found');
    return story;
  }

  /** Saves the description without creating a story version (the text of the story does not change). */
  async _savePrompt(story, prompt) {
    await query('UPDATE stories SET illustration_prompt = ? WHERE id = ?', [prompt, story.id]);
    return { id: story.id, illustration_prompt: prompt, imagePrompt: buildImagePrompt({ ...story, illustration_prompt: prompt }) };
  }

  /**
   * Writes the illustration description of a story with the AI (Gemini, or Ollama without Gemini key).
   * @param {string} storyId
   * @returns {Promise<{id: string, illustration_prompt: string, imagePrompt: string}>}
   */
  async generatePrompt(storyId) {
    const story = await this._findStory(storyId);
    const request = buildIllustrationRequest(story);
    const ai = geminiService.apiKey ? geminiService : localLLMService;
    const { text } = await ai.generateText(ILLUSTRATION_PROMPT_SYSTEM, request, 'IllustrationPrompt');
    const prompt = cleanIllustrationPrompt(text).slice(0, PROMPT_MAX);
    if (!prompt) throw new Error('The AI returned an empty description.');
    return this._savePrompt(story, prompt);
  }

  /**
   * Manual correction of the description.
   * @param {string} storyId
   * @param {string} prompt
   */
  async setPrompt(storyId, prompt) {
    const clean = String(prompt ?? '').trim();
    if (!clean) throw new ValidationError('The description is empty');
    if (clean.length > PROMPT_MAX) throw new ValidationError(`The description must be at most ${PROMPT_MAX} characters`);
    const story = await this._findStory(storyId);
    return this._savePrompt(story, clean);
  }
}

export const illustrationService = new IllustrationService();
