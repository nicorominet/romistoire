import { auditModels, geminiService } from './gemini.service.js';
import { localLLMService } from './local_llm.service.js';
import { detectCastDefects, recurringUnknownNames } from './helpers/cast_check.helper.js';
import { AUDIT_SYSTEM, buildWeekAuditPrompt, fallbackRecap, parseWeekAudit } from './helpers/week_audit.helper.js';
import { castForWeek } from './helpers/cast_validation.helper.js';
import { GENERATION_DAYS_FR } from './helpers/generation_plan.helper.js';
import { generationJobRepository as repo } from './generation_job.repository.js';
import { seriesCastService } from './series_cast.service.js';
import { weeklyThemeService } from './weeklyTheme.service.js';
import { NotFoundError, ValidationError } from '../middleware/error.middleware.js';

/**
 * Consistency audit of a week written with a series bible (framed generation):
 * the local checks (free) on every day, then one AI request for the week when asked.
 */

/** Local defect -> issue of the audit. */
const LOCAL_ISSUES = {
  'reserved-name': { type: 'name', severity: 'high' },
  'wrong-age': { type: 'age', severity: 'high' },
  'missing-main': { type: 'other', severity: 'medium' },
  'trait-conflict': { type: 'appearance', severity: 'medium' }
};
const AUDIT_OUTPUT_TOKENS = 4000;

/** Plain paragraphs of a story saved as editor HTML. */
const paragraphsOf = (html) => (String(html || '').match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [String(html || '')])
  .map(paragraph => paragraph.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim())
  .filter(Boolean);

/**
 * Issues found without AI: the bible checks of each day, and the guests that come back during the week.
 * @param {Object} cast - Cast as told this week (castForWeek).
 * @param {{day: string, content: string, illustrationPrompt?: string}[]} stories
 * @param {{reservedNames?: string[], known?: string[]}} [options]
 */
export const localWeekIssues = (cast, stories, { reservedNames = [], known = [] } = {}) => {
  const parsed = stories.map(story => ({ day: story.day, paragraphs: paragraphsOf(story.content), illustration_prompt: story.illustrationPrompt || '' }));
  const issues = detectCastDefects(parsed, cast, { reservedNames }).map(defect => ({
    day: parsed[defect.index]?.day || '',
    character: String(defect.detail || '').split(' ')[0],
    ...LOCAL_ISSUES[defect.code],
    quote: '',
    explanation: defect.hint.replace(/^[^:]+ : /, ''),
    source: 'local'
  }));
  for (const { name, days } of recurringUnknownNames(parsed.map(story => story.paragraphs.join('\n')), cast, known)) {
    issues.push({
      day: '', character: name, type: 'new-character', severity: 'medium', quote: '', source: 'local',
      explanation: `« ${name} », absent de la bible, revient ${days} jours sur ${stories.length} : invité ponctuel ou nouveau personnage à ajouter à la bible ?`
    });
  }
  return issues;
};

class SeriesAuditService {
  /**
   * Audits a week.
   * @param {{cast: Object, facts?: Object[], stories: {id: string, day: string, title: string, content: string, summary?: string,
   *   illustrationPrompt?: string}[], theme?: string, weekNumber: number, ageGroup: string, provider?: 'gemini'|'local',
   *   useAI?: boolean, reservedNames?: string[], known?: string[], beforeRequest?: () => Promise<void>}} input
   *   beforeRequest: awaited before the AI request (pacing and quota of a framed job; may throw to postpone the audit).
   * @returns {Promise<{status: 'done'|'local', issues: Object[], recap: string, newFacts: string[], model: string|null, at: string, note?: string}>}
   *   status "local": no AI audit (not asked, or its answer could not be read).
   */
  async auditWeek({ cast, facts = [], stories, theme, weekNumber, ageGroup, provider = 'gemini', useAI = true, reservedNames = [], known = [], beforeRequest }) {
    const local = localWeekIssues(cast, stories, { reservedNames, known });
    const base = { issues: local, recap: fallbackRecap(stories), newFacts: [], model: null, at: new Date().toISOString() };
    if (!useAI || stories.length === 0) return { status: 'local', ...base };

    if (beforeRequest) await beforeRequest();
    const ai = provider === 'local' || !geminiService.apiKey ? localLLMService : geminiService;
    const prompt = buildWeekAuditPrompt({
      cast, facts, theme, weekNumber, ageGroup,
      stories: stories.map(story => ({ day: story.day, title: story.title, text: paragraphsOf(story.content).join('\n'), illustrationPrompt: story.illustrationPrompt }))
    });
    // Gemini: the Flash Lite then Gemma models of the configured list, never the Flash ones (the stories of the 7+)
    const { text, model } = await ai.generateText(AUDIT_SYSTEM, prompt, 'WeekAudit', {
      maxOutputTokens: AUDIT_OUTPUT_TOKENS, ...(ai === geminiService ? { models: auditModels() } : {})
    });
    const audit = parseWeekAudit(text, stories.map(story => story.day));
    if (!audit) return { status: 'local', ...base, model: model || null, note: 'The AI audit could not be read' };
    return {
      status: 'done',
      issues: [...local, ...audit.issues],
      recap: audit.recap || base.recap,
      newFacts: audit.newFacts,
      model: model || null,
      at: base.at
    };
  }

  /**
   * Audits a week already written (by a framed job, or again on demand) and saves its recap, its audit and the
   * facts it proposes. An error saves the local audit: "postponed" when the quota is out (error.postpone), the
   * job audits it again when it resumes; "failed" otherwise.
   * @param {{castId: string, ageGroup: string, weekNumber: number, useAI?: boolean, provider?: 'gemini'|'local',
   *   rewritten?: boolean, beforeRequest?: () => Promise<void>}} input - rewritten: the week was regenerated, the next
   *   weeks already audited become stale.
   * @returns {Promise<{status: string, issues: Object[], recap: string, newFacts: string[], stale?: number}>}
   * @throws The error of the AI request once the local audit is saved.
   */
  async auditStoredWeek({ castId, ageGroup, weekNumber, useAI = true, provider = 'gemini', rewritten = false, beforeRequest }) {
    const castRow = await seriesCastService.get(castId);
    if (!castRow.ageGroups.includes(ageGroup)) throw new ValidationError('This age group is not in the cast');
    const seriesName = await seriesCastService.seriesName(castRow.seriesId);
    const cast = castForWeek(castRow, weekNumber);
    const stories = (await repo.existingStories(weekNumber, ageGroup))
      .filter(story => (story.series_name || '') === seriesName)
      .map(story => ({
        id: story.id, day: GENERATION_DAYS_FR[Number(story.day_order) - 1] || '', title: story.title, content: story.content,
        summary: story.summary, illustrationPrompt: story.illustration_prompt || ''
      }));
    if (stories.length === 0) throw new NotFoundError('No story of the series for this week');
    const topic = await weeklyThemeService.findByWeek(weekNumber);
    const facts = await seriesCastService.factsBefore(castId, ageGroup, weekNumber);
    // Words a story may repeat without a new character: the series, the topic of the week, the facts established
    const known = [seriesName, topic?.theme_name, topic?.theme_description, ...facts.map(fact => fact.text)];
    const options = { reservedNames: await repo.seriesNames(), known };

    let audit;
    try {
      audit = await this.auditWeek({
        cast, stories, weekNumber, ageGroup, provider, useAI, beforeRequest, ...options, facts, theme: topic?.theme_name
      });
    } catch (error) {
      await seriesCastService.saveRecap(castId, ageGroup, weekNumber, {
        recap: fallbackRecap(stories),
        audit: {
          status: error.postpone ? 'postponed' : 'failed', issues: localWeekIssues(cast, stories, options), newFacts: [],
          model: null, at: new Date().toISOString(), note: error.message, storyIds: stories.map(story => story.id), castVersion: castRow.version
        }
      });
      throw error;
    }
    await seriesCastService.saveRecap(castId, ageGroup, weekNumber, {
      recap: audit.recap,
      audit: { ...audit, storyIds: stories.map(story => story.id), castVersion: castRow.version }
    });
    await seriesCastService.replaceProposedFacts(castId, ageGroup, weekNumber, audit.newFacts);
    const stale = rewritten ? await seriesCastService.markStaleAfter(castId, ageGroup, weekNumber) : 0;
    return { ...audit, stale };
  }
}

export const seriesAuditService = new SeriesAuditService();
