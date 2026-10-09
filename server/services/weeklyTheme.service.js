import { query } from '../config/database.js';
import { ValidationError } from '../middleware/error.middleware.js';
import { geminiService } from './gemini.service.js';
import { localLLMService } from './local_llm.service.js';
import { settingsService } from './settings.service.js';
import { TOPIC_SUGGESTION_SYSTEM, buildTopicSuggestionPrompt, parseTopicSuggestions } from './helpers/topic_suggestion.helper.js';

const MAX_WEEK = 53;
const NAME_MAX = 150;
const DESCRIPTION_MAX = 500;

/**
 * Topics of the week: free text (name + description) that guides story writing.
 * Not to be confused with story themes (tags, table `themes`).
 */
class WeeklyThemeService {
  /** All configured weeks, ordered by week number. */
  async findAll() {
    const rows = await query(
      'SELECT week_number, theme_name, theme_description FROM weekly_themes ORDER BY week_number ASC'
    );
    return rows.map(row => ({
      week_number: Number(row.week_number),
      theme_name: row.theme_name,
      theme_description: row.theme_description ?? ''
    }));
  }

  async findByWeek(weekNumber) {
    const rows = await query(
      'SELECT week_number, theme_name, theme_description FROM weekly_themes WHERE week_number = ?',
      [Number(weekNumber)]
    );
    const row = rows[0];
    return row ? { week_number: Number(row.week_number), theme_name: row.theme_name, theme_description: row.theme_description ?? '' } : null;
  }

  _toWeek(weekNumber, max = MAX_WEEK) {
    const week = Number(weekNumber);
    if (!Number.isInteger(week) || week < 1 || week > max) {
      throw new ValidationError(`Week number must be between 1 and ${max}`);
    }
    return week;
  }

  /**
   * Set the topic of a week.
   * @param {number} weekNumber - 1 to 53.
   * @param {{name: string, description?: string}} data
   */
  async setWeek(weekNumber, { name, description } = {}) {
    const week = this._toWeek(weekNumber);
    const cleanName = String(name ?? '').trim();
    if (!cleanName) throw new ValidationError('A topic is required');
    if (cleanName.length > NAME_MAX) throw new ValidationError(`The topic must be at most ${NAME_MAX} characters`);
    const cleanDescription = String(description ?? '').trim();
    if (cleanDescription.length > DESCRIPTION_MAX) {
      throw new ValidationError(`The description must be at most ${DESCRIPTION_MAX} characters`);
    }

    await query(
      `INSERT INTO weekly_themes (week_number, theme_name, theme_description) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE theme_name = VALUES(theme_name), theme_description = VALUES(theme_description)`,
      [week, cleanName, cleanDescription || null]
    );
    return await this.findByWeek(week);
  }

  /** Remove the topic of a week. Any positive week is accepted, so legacy rows (> 53) can be cleaned up. */
  async clearWeek(weekNumber) {
    const week = this._toWeek(weekNumber, Number.MAX_SAFE_INTEGER);
    await query('DELETE FROM weekly_themes WHERE week_number = ?', [week]);
    return true;
  }

  /**
   * AI suggestions for weeks of the program (nothing is saved: the user picks what to keep).
   * Same provider choice as the illustration descriptions: Gemini, unless Ollama is chosen or Gemini has no key.
   * @param {number[]} weeks - 1 to 53, at most 26 at a time.
   * @returns {Promise<{week: number, name: string, description: string}[]>}
   */
  async suggest(weeks) {
    const list = [...new Set((Array.isArray(weeks) ? weeks : []).map(Number))]
      .filter(week => Number.isInteger(week) && week >= 1 && week <= MAX_WEEK)
      .sort((a, b) => a - b);
    if (list.length === 0) throw new ValidationError('Choose at least one week');
    if (list.length > 26) throw new ValidationError('At most 26 weeks at a time');

    const existing = await this.findAll();
    const ai = settingsService.ai.defaultProvider !== 'local' && geminiService.apiKey ? geminiService : localLLMService;
    const { text } = await ai.generateText(TOPIC_SUGGESTION_SYSTEM, buildTopicSuggestionPrompt(list, existing), 'TopicSuggestion', { maxOutputTokens: 4000 });
    const suggestions = parseTopicSuggestions(text, list);
    if (suggestions.length === 0) throw new Error('The AI answer could not be read. Try again.');
    return suggestions;
  }

  /**
   * Batch update (legacy endpoint): [{ week_number, theme_name, theme_description? }].
   * Weeks without a name are skipped.
   */
  async update(weeks) {
    if (!Array.isArray(weeks)) throw new ValidationError('An array of weeks is expected');
    for (const week of weeks) {
      if (!String(week?.theme_name || '').trim()) continue;
      await this.setWeek(week.week_number, { name: week.theme_name, description: week.theme_description });
    }
    return true;
  }
}

export const weeklyThemeService = new WeeklyThemeService();
