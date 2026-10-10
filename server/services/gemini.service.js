import dotenv from 'dotenv';
import { logger } from './logger.service.js';
import { PromptHelper, ALL_WEEK } from './helpers/prompt.helper.js';
import { geminiResponseSchema } from './helpers/story_schema.js';
import { COOLDOWN_MS, ModelCooldowns, msUntilPacificMidnight, parseRateLimit } from './helpers/model_cooldown.helper.js';
import { settingsService } from './settings.service.js';
import {
  buildTtsRequestBody, checkSplit, hasDialogue, parseSpeakerLines, resolveAudioOptions, splitDialogueHeuristic,
  CHARACTERS, NARRATOR, SAMPLE_TEXT, SPLIT_INSTRUCTION
} from './helpers/voice.helper.js';
import { aiUsageService } from './ai_usage.service.js';
dotenv.config();

// Models configuration with fallback priority (override with GEMINI_MODELS="model-a,model-b").
// Checked against the API on 2026-10-07 (`node scripts/list_models.js` lists them and flags
// configured models that no longer exist). Ordered for the free tier:
// - Flash Lite first: native JSON, 15 requests/min and 500/day each (enough for day-by-day weeks);
// - Flash: native JSON, but 5 requests/min and 20/day each;
// - Gemma: 14,400/day but slow (thinking), no JSON mode, 16K input tokens/min: last resort.
// Teenagers' stories (900+ words) start with the Flash models instead: see modelsForAge.
export const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it'
];

// Models that support Audio Generation (override with GEMINI_AUDIO_MODELS). Free tier: 3 per minute and
// 10 per day each, the same for all of them, so ordered by quality: 3.8 first (most expressive, takes the
// reading style apart from the text), 2.5 last (style given as an instruction before the text).
export const DEFAULT_AUDIO_MODELS = [
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts', // raw 24 kHz PCM
];

const parseModelList = (value, fallback) => {
  const models = (value || '').split(',').map(m => m.trim()).filter(Boolean);
  return models.length > 0 ? models : fallback;
};

// Configuration from .env (or the code defaults): Settings > AI generation overrides it, read on every call
export const MODELS = parseModelList(process.env.GEMINI_MODELS, DEFAULT_MODELS);
export const AUDIO_MODELS = parseModelList(process.env.GEMINI_AUDIO_MODELS, DEFAULT_AUDIO_MODELS);

// One story per call (weeks are generated day by day): 120 s is plenty for a Flash model
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 120000;
// A whole week in one answer (young ages) is about 7 times longer to write
const WEEK_REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_WEEK_TIMEOUT_MS) || 240000;

// Temperatures when no creativity is set: stories are freer than short helper texts
const STORY_TEMPERATURE = 0.9;
const TEXT_TEMPERATURE = 0.7;

/**
 * Configuration in use: settings page first, then .env, then code defaults.
 * @returns {{models: string[], audioModels: string[], timeoutMs: number, weekTimeoutMs: number, creativity: number|null}}
 */
export const geminiConfig = () => {
  const ai = settingsService.ai;
  return {
    models: ai.geminiModels ?? MODELS,
    audioModels: ai.geminiAudioModels ?? AUDIO_MODELS,
    timeoutMs: ai.geminiTimeoutMs ?? REQUEST_TIMEOUT_MS,
    weekTimeoutMs: ai.geminiWeekTimeoutMs ?? WEEK_REQUEST_TIMEOUT_MS,
    creativity: ai.creativity
  };
};
// A whole week in one answer: exactly one story per day
const WEEK_STORY_COUNT = 7;
// One more try on the same model for transient errors, then the next model
const MAX_RETRIES_PER_MODEL = 1;
const RETRY_BASE_DELAY_MS = 2000;
// Per-minute rate limit: wait the delay suggested by the API when it is short, else next model
const MAX_RATE_LIMIT_WAIT_MS = 20000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60000;

// Output budget: one story is up to ~1400 words; a whole week in one call (API only) is 7 of them
const MAX_OUTPUT_TOKENS_SINGLE = 8192;
const MAX_OUTPUT_TOKENS_WEEK = 32768;

// Transient server errors worth one more try on the same model
const TRANSIENT_STATUSES = [500, 502, 503, 504];
// Errors caused by the request or the key: switching model would not help
const FATAL_STATUSES = [400, 401, 403];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// What each model family accepts. Gemma models reject systemInstruction and JSON mode with a 400
// (fatal, so no fallback would happen): they get the instruction inline and JSON is asked by the prompt.
// Thinking is kept low for storytelling: faster answers, fewer output tokens spent on reasoning.
const MODEL_CAPABILITIES = [
  { prefix: 'gemma-', systemInstruction: false, jsonSchema: false, thinkingConfig: null },
  { prefix: 'gemini-2.5-', systemInstruction: true, jsonSchema: true, thinkingConfig: { thinkingBudget: 0 } },
  { prefix: 'gemini-', systemInstruction: true, jsonSchema: true, thinkingConfig: { thinkingLevel: 'low' } }
];

export const getModelCapabilities = (model) =>
  MODEL_CAPABILITIES.find(c => model.startsWith(c.prefix)) || { systemInstruction: false, jsonSchema: false, thinkingConfig: null };

/**
 * Age groups written by the Flash models first. Flash Lite stops around 700 words, and the content audit
 * of October 2026 found its 7-12 stories far weaker (generation slips, lost plot threads) than Flash's.
 */
const FLASH_FIRST_AGES = ['7-9', '10-12', '13-15', '16-18'];
/** Best Flash model of the audit, tried first. */
const PREFERRED_FLASH = 'gemini-3-flash-preview';
/** Weakest science of the audit: kept as a late fallback, just before Gemma. */
const LATE_FLASH = 'gemini-2.5-flash';

const isFlashModel = (model) => /^gemini-.*-flash(?:-preview)?$/.test(model);

/**
 * Model order for an age group. From 7 years old: the preferred Flash model, the other Flash models,
 * every other Gemini model in the configured order, the late Flash model, then Gemma.
 * Younger ages keep the configured order (Flash Lite first: short stories, larger quota).
 * @param {string[]} models - Configured order.
 * @param {string} age - Age group ("13-15" or "13-15 ans").
 * @returns {string[]}
 */
export const modelsForAge = (models, age) => {
  if (!FLASH_FIRST_AGES.includes(PromptHelper.normalizeAge(age))) return models;
  const rank = (model) => {
    if (model === PREFERRED_FLASH) return 0;
    if (model === LATE_FLASH) return 3;
    if (isFlashModel(model)) return 1;
    return model.startsWith('gemma-') ? 4 : 2;
  };
  // Stable sort: the configured order is kept inside each rank
  return models.map((model, index) => ({ model, index })).sort((a, b) => rank(a.model) - rank(b.model) || a.index - b.index).map(({ model }) => model);
};

/** Models skipped after a failure (shared by story and audio calls). */
export const modelCooldowns = new ModelCooldowns();

/**
 * Builds the generateContent body for a story, adapted to what the model supports.
 * @param {string} model - Model id.
 * @param {string} systemInstruction - System instruction.
 * @param {string} prompt - User prompt.
 * @param {number} maxOutputTokens - Output budget.
 * @param {{thinking?: boolean, withWeekPlan?: boolean, minParagraphs?: number}} [options] - thinking: false drops
 *   the thinking config (model rejected it); withWeekPlan: the JSON schema also requires the plan of the week and
 *   the character sheets; storyCount: exact number of stories (7 for a whole week); minParagraphs: minimum number of paragraphs. Not used for stories: a forced count
 *   makes small models pad the story with filler or the illustration description.
 * @returns {Object} Request body.
 */
export const buildStoryRequestBody = (model, systemInstruction, prompt, maxOutputTokens, { thinking = true, withWeekPlan = false, withCharacters = false, minParagraphs = 0, storyCount = 0 } = {}) => {
  const capabilities = getModelCapabilities(model);
  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: capabilities.systemInstruction ? prompt : `${systemInstruction}\n\n${prompt}` }]
    }],
    generationConfig: { maxOutputTokens, temperature: geminiConfig().creativity ?? STORY_TEMPERATURE }
  };
  if (thinking && capabilities.thinkingConfig) {
    body.generationConfig.thinkingConfig = { ...capabilities.thinkingConfig };
  }
  if (capabilities.systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (capabilities.jsonSchema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = geminiResponseSchema({ withWeekPlan, withCharacters, minParagraphs, storyCount });
  }
  return body;
};

/**
 * Error raised for a Gemini API failure that must not trigger a model fallback.
 */
export class GeminiFatalError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Adds a WAV header to raw PCM data.
 * @param {Buffer} pcmData - Raw PCM data.
 * @param {number} sampleRate - Sample rate in Hz (default 24000).
 * @param {number} numChannels - Number of channels (default 1).
 * @param {number} bitDepth - Bit depth (default 16).
 * @returns {Buffer} Buffer with WAV header and PCM data.
 */
function addWavHeader(pcmData, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
    const header = Buffer.alloc(44);
    const byteRate = (sampleRate * numChannels * bitDepth) / 8;
    const blockAlign = (numChannels * bitDepth) / 8;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    // RIFF identifier
    header.write('RIFF', 0);
    // File size - 8
    header.writeUInt32LE(fileSize, 4);
    // WAVE identifier
    header.write('WAVE', 8);
    // fmt chunk identifier
    header.write('fmt ', 12);
    // fmt chunk size
    header.writeUInt32LE(16, 16);
    // Audio format (1 = PCM)
    header.writeUInt16LE(1, 20);
    // Number of channels
    header.writeUInt16LE(numChannels, 22);
    // Sample rate
    header.writeUInt32LE(sampleRate, 24);
    // Byte rate
    header.writeUInt32LE(byteRate, 28);
    // Block align
    header.writeUInt16LE(blockAlign, 32);
    // Bits per sample
    header.writeUInt16LE(bitDepth, 34);
    // data chunk identifier
    header.write('data', 36);
    // Data size
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
}

/**
 * Converts the audio returned by Gemini into a playable file.
 * Raw PCM ("audio/L16;codec=pcm;rate=24000" or "audio/pcm") gets a WAV header using the
 * advertised sample rate; already-encoded formats (wav, mp3, ogg...) are kept as is.
 * @param {Buffer} buffer - Decoded audio bytes.
 * @param {string} mimeType - MIME type reported by the API.
 * @returns {{audioBuffer: Buffer, mimeType: string, extension: string}}
 */
export function toPlayableAudio(buffer, mimeType = '') {
    const type = mimeType.toLowerCase();
    if (type.startsWith('audio/l16') || type.startsWith('audio/pcm')) {
        const rate = Number(type.match(/rate=(\d+)/)?.[1]) || 24000;
        return { audioBuffer: addWavHeader(buffer, rate), mimeType: 'audio/wav', extension: 'wav' };
    }
    const knownTypes = {
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm'
    };
    const baseType = type.split(';')[0].trim();
    if (knownTypes[baseType]) {
        return { audioBuffer: buffer, mimeType: baseType === 'audio/mp3' ? 'audio/mpeg' : baseType, extension: knownTypes[baseType] };
    }
    // Unknown type: historically the TTS model returns raw 24 kHz PCM
    return { audioBuffer: addWavHeader(buffer), mimeType: 'audio/wav', extension: 'wav' };
}

/**
 * Service for interacting with Google Gemini API to generate content.
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
    // Models that rejected the thinking config: called without it from then on
    this.noThinking = new Set();
  }

  /**
   * Calls generateContent, falling back through the given models.
   * Models that recently failed are skipped (see modelCooldowns), so a saturated or exhausted model
   * does not slow down every call.
   * - 400/401/403: fatal (bad request or key), no fallback, real API message surfaced.
   *   A 400 about the thinking config is retried once without it.
   * - 500/502/503/504: one more try on the same model, then next model (503: model skipped 5 min).
   * - 429: daily quota → model skipped until the Pacific-time reset; per-minute limit → short wait
   *   (delay suggested by the API) or next model.
   * - 404: next model (skipped 1 h). Timeout: next model (skipped 10 min). Network error: next model.
   * @param {string[]} models - Models in priority order.
   * @param {Object|Function} body - generateContent request body, or a function (model, { thinking }) => body.
   * @param {string} label - Label for logs.
   * @param {{timeoutMs?: number, nextModelOn400?: boolean}} [options] - timeoutMs: per-request timeout (default: the configured
   *   one-story timeout); nextModelOn400: a 400 skips the model (1 h) and tries the next one instead of failing (audio models
   *   do not all accept the same request).
   * @returns {Promise<{result: Object, model: string, skipped: {model: string, reason: string}[]}>}
   *   Parsed JSON response, the model that answered and the models skipped or failed before it.
   */
  async _generateWithFallback(models, body, label, { timeoutMs = geminiConfig().timeoutMs, nextModelOn400 = false } = {}) {
    const { models: candidates, skipped } = modelCooldowns.filter(models);
    const failures = skipped.map(({ model, reason }) => ({ model, reason: `skipped (${reason})` }));
    if (skipped.length > 0) {
      console.log(`[Gemini] ${label}: skipping ${skipped.map(s => `${s.model} (${s.reason})`).join(', ')}`);
    }

    for (const model of candidates) {
        let thinkingRetried = false;
        for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
            const thinking = !this.noThinking.has(model);
            // Every request sent is recorded for the quota statistics
            const startedAt = new Date();
            const track = (outcome, httpStatus = null) => aiUsageService.record({
                at: startedAt, model, label, outcome, httpStatus, durationMs: Date.now() - startedAt.getTime()
            });
            let response;
            try {
                console.log(`[Gemini] ${label}: model ${model} (attempt ${attempt + 1})`);
                response = await fetch(`${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(typeof body === 'function' ? body(model, { thinking }) : body),
                    signal: AbortSignal.timeout(timeoutMs)
                });
            } catch (error) {
                const isTimeout = error.name === 'TimeoutError';
                const reason = isTimeout ? `timeout after ${timeoutMs}ms` : error.message;
                console.error(`[Gemini] ${label}: network error on ${model}: ${reason}`);
                if (isTimeout) modelCooldowns.skip(model, COOLDOWN_MS.timeout, 'timeout');
                track(isTimeout ? 'timeout' : 'error');
                failures.push({ model, reason });
                break; // next model
            }

            if (response.ok) {
                track('ok', response.status);
                return { result: await response.json(), model, skipped: failures };
            }

            const errorText = await response.text().catch(() => '');
            track(
                response.status === 429 ? (parseRateLimit(errorText).daily ? 'daily_quota' : 'rate_limit')
                    : response.status === 503 ? 'overloaded' : 'error',
                response.status
            );
            let apiMessage = errorText;
            try { apiMessage = JSON.parse(errorText)?.error?.message || errorText; } catch (e) { /* plain text */ }
            console.warn(`[Gemini] ${label}: error ${response.status} on ${model}: ${apiMessage}`);

            if (response.status === 400 && thinking && !thinkingRetried && /thinking/i.test(apiMessage)) {
                // This model does not accept our thinking config: same call without it
                this.noThinking.add(model);
                thinkingRetried = true;
                attempt--;
                continue;
            }

            if (response.status === 400 && nextModelOn400) {
                modelCooldowns.skip(model, COOLDOWN_MS.notFound, 'invalid request');
                failures.push({ model, reason: `400 ${apiMessage}` });
                break; // next model
            }

            if (FATAL_STATUSES.includes(response.status)) {
                throw new GeminiFatalError(`Gemini API error ${response.status}: ${apiMessage}`, response.status);
            }

            if (response.status === 429) {
                const { daily, retryDelayMs } = parseRateLimit(errorText);
                if (daily) {
                    modelCooldowns.skip(model, msUntilPacificMidnight(), 'daily quota');
                    failures.push({ model, reason: '429 daily quota' });
                    break;
                }
                if (retryDelayMs !== null && retryDelayMs <= MAX_RATE_LIMIT_WAIT_MS && attempt < MAX_RETRIES_PER_MODEL) {
                    await wait(retryDelayMs);
                    continue;
                }
                modelCooldowns.skip(model, retryDelayMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS, 'rate limit');
                failures.push({ model, reason: '429 rate limit' });
                break;
            }

            if (TRANSIENT_STATUSES.includes(response.status)) {
                if (attempt < MAX_RETRIES_PER_MODEL) {
                    await wait(RETRY_BASE_DELAY_MS * 2 ** attempt);
                    continue;
                }
                if (response.status === 503) modelCooldowns.skip(model, COOLDOWN_MS.overloaded, 'overloaded');
            } else if (response.status === 404) {
                modelCooldowns.skip(model, COOLDOWN_MS.notFound, 'not found');
            }

            failures.push({ model, reason: String(response.status) });
            break; // next model
        }
    }

    throw new Error(`All Gemini/Gemma models failed (${failures.map(f => `${f.model}: ${f.reason}`).join(', ')}).`);
  }

  /**
   * Generates a story based on provided parameters using Gemini/Gemma.
   * @param {Object} params - Generation parameters.
   * @param {string} params.theme - The weekly theme.
   * @param {string} params.age - The target age group (e.g., "4-6").
   * @param {string} [params.day] - The day of the week or "Toute la semaine".
   * @param {number} [params.numCharacters] - Number of main characters.
   * @param {string} [params.charNames] - Names of main characters.
   * @param {string} [params.seriesName] - Name of the series if part of one.
   * @param {string} [params.previousSummary] - Summary of the previous story.
   * @param {string} [params.previousChapter] - Previous story content (fallback).
   * @param {boolean} [params.weekSeries] - The day belongs to a 7-day series generated day by day.
   * @returns {Promise<{text: string, model: string, finishReason: string, truncated: boolean, skipped: Object[]}>}
   *   The generated story text and metadata (`skipped`: models skipped or failed before `model`).
   * @throws {Error} If API key is missing, the content is blocked or generation fails.
   */
  async generateStory(params) {
    if (!this.apiKey) {
        throw new Error("Gemini API Key not configured.");
    }

    // Use shared prompt helper
    const systemInstruction = PromptHelper.buildSystemInstruction();
    const prompt = PromptHelper.buildStoryPrompt(params);
    const { theme, age, day, numCharacters, charNames, seriesName } = params;
    const isWeek = day === ALL_WEEK;
    const maxOutputTokens = isWeek ? MAX_OUTPUT_TOKENS_WEEK : MAX_OUTPUT_TOKENS_SINGLE;
    const withWeekPlan = PromptHelper.wantsWeekPlan(params);
    const withCharacters = PromptHelper.wantsCharacters(params);
    const config = geminiConfig();

    const startTime = Date.now();
    try {
        const { result, model, skipped } = await this._generateWithFallback(
            modelsForAge(config.models, age),
            (model, options) => buildStoryRequestBody(model, systemInstruction, prompt, maxOutputTokens, { ...options, withWeekPlan, withCharacters, storyCount: isWeek ? WEEK_STORY_COUNT : 0 }),
            'Story',
            { timeoutMs: isWeek ? config.weekTimeoutMs : config.timeoutMs }
        );

        const blockReason = result.promptFeedback?.blockReason;
        if (blockReason) throw new Error(`Generation blocked by Gemini (${blockReason}).`);

        const candidate = result.candidates?.[0];
        const finishReason = candidate?.finishReason || 'UNKNOWN';
        // Thinking models may return thought parts: keep the answer only
        const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('') || '';

        if (['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(finishReason)) {
            throw new Error(`Generation stopped by Gemini (${finishReason}).`);
        }
        if (!text) throw new Error(`Empty response from Gemini (finishReason: ${finishReason}).`);

        const truncated = finishReason === 'MAX_TOKENS';
        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Story', { theme, age, day, numCharacters, charNames, seriesName, promptLength: prompt.length }, { text, model, finishReason, skipped }, { duration });

        return { text, model, finishReason, truncated, skipped };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Story-Error', { theme, age, day, promptLength: prompt.length }, { error: error.message }, { duration, success: false });
        throw error;
    }
  }

  /**
   * Short plain-text answer (no JSON schema), with the same model order and fallbacks as the stories.
   * @param {string} systemInstruction
   * @param {string} prompt
   * @param {string} label - Label for console and AI logs.
   * @param {{maxOutputTokens?: number}} [options]
   * @returns {Promise<{text: string, model: string}>}
   */
  async generateText(systemInstruction, prompt, label, { maxOutputTokens = 600 } = {}) {
    if (!this.apiKey) throw new Error("Gemini API Key not configured.");
    const startTime = Date.now();
    try {
      const { result, model, skipped } = await this._generateWithFallback(geminiConfig().models, (model, { thinking }) => {
        const capabilities = getModelCapabilities(model);
        const body = {
          contents: [{ role: 'user', parts: [{ text: capabilities.systemInstruction ? prompt : `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: { maxOutputTokens, temperature: geminiConfig().creativity ?? TEXT_TEMPERATURE }
        };
        if (thinking && capabilities.thinkingConfig) body.generationConfig.thinkingConfig = { ...capabilities.thinkingConfig };
        if (capabilities.systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
        return body;
      }, label);

      const candidate = result.candidates?.[0];
      const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('').trim() || '';
      if (!text) throw new Error(`Empty response from Gemini (finishReason: ${candidate?.finishReason || result.promptFeedback?.blockReason || 'UNKNOWN'}).`);

      logger.ai('Gemini', label, { promptLength: prompt.length }, { text, model, skipped }, { duration: Date.now() - startTime });
      return { text, model };
    } catch (error) {
      logger.ai('Gemini', `${label}-Error`, { promptLength: prompt.length }, { error: error.message }, { duration: Date.now() - startTime, success: false });
      throw error;
    }
  }

  /**
   * Splits a story between the narrator and the characters for a two-voice reading: by the AI, checked word
   * for word against the story, else by the dialogue dashes and guillemets.
   * @param {string} text
   * @returns {Promise<{segments: {speaker: string, text: string}[], method: 'ai'|'heuristic'}>}
   */
  async splitDialogue(text) {
    try {
      const { text: answer } = await this.generateText(SPLIT_INSTRUCTION, text, 'Audio-Split', { maxOutputTokens: 8192 });
      const segments = parseSpeakerLines(answer);
      if (checkSplit(text, segments)) return { segments, method: 'ai' };
      console.warn('[Gemini] Two-voice split changed the text, using the dialogue marks instead');
    } catch (error) {
      console.warn('[Gemini] Two-voice split failed, using the dialogue marks instead:', error.message);
    }
    return { segments: splitDialogueHeuristic(text), method: 'heuristic' };
  }

  /**
   * Generates audio for a given text using Gemini.
   * @param {string} text - The text to convert to audio.
   * @param {Object} [resolved] - Voice, style and two-voice choice (see voice.helper resolveAudioOptions).
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string, extension: string}>} The playable audio file, its mime type and extension.
   */
  async generateAudio(text, resolved = resolveAudioOptions()) {
    if (!this.apiKey) {
      throw new Error("Gemini API Key not configured.");
    }

    let input = text;
    let split = 'single';
    if (resolved.multiSpeaker) {
      const { segments, method } = await this.splitDialogue(text);
      // Without any dialogue the second voice would never speak: one voice then
      if (hasDialogue(segments)) {
        input = segments;
        split = method;
      } else {
        split = 'no-dialogue';
      }
    }
    return this._speak(input, resolved, { textLength: text.length, split });
  }

  /**
   * Short reading of a fixed sentence with the given voice options (Settings > reading voice), not stored.
   * @param {Object} resolved - See voice.helper resolveAudioOptions.
   */
  async generateVoiceSample(resolved) {
    if (!this.apiKey) {
      throw new Error("Gemini API Key not configured.");
    }
    const input = resolved.multiSpeaker
      ? [{ speaker: NARRATOR, text: SAMPLE_TEXT.narrator }, { speaker: CHARACTERS, text: SAMPLE_TEXT.character }]
      : `${SAMPLE_TEXT.narrator} ${SAMPLE_TEXT.character}`;
    return this._speak(input, resolved, { sample: true });
  }

  /** TTS call through the audio models, returning a playable file. */
  async _speak(input, resolved, logInput) {
    const startTime = Date.now();
    const voices = { voice: resolved.voice, characterVoice: Array.isArray(input) ? resolved.characterVoice : undefined, style: resolved.style, pace: resolved.pace };
    try {
        const { result, model } = await this._generateWithFallback(
            geminiConfig().audioModels,
            (model) => buildTtsRequestBody(model, input, resolved),
            'Audio',
            { nextModelOn400: true }
        );

        const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('audio/'));

        if (!audioPart?.inlineData?.data) {
            logger.ai('Gemini', 'Audio-Error', { ...logInput, ...voices }, { error: 'No audio content in response' }, { duration: Date.now() - startTime, success: false });
            console.error("No audio content in response:", JSON.stringify(result, null, 2));
            throw new Error("No audio generated by Gemini.");
        }

        const rawAudioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
        const audio = toPlayableAudio(rawAudioBuffer, audioPart.inlineData.mimeType);

        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Audio', { ...logInput, ...voices }, { audioSize: audio.audioBuffer.length, model, sourceMimeType: audioPart.inlineData.mimeType }, { duration });

        return audio;
    } catch (error) {
         const duration = Date.now() - startTime;
         logger.ai('Gemini', 'Audio-Error', { ...logInput, ...voices }, { error: error.message }, { duration, success: false });
         throw error;
    }
  }
}

export const geminiService = new GeminiService();
