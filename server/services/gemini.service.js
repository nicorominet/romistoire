import dotenv from 'dotenv';
import { logger } from './logger.service.js';
import { PromptHelper, ALL_WEEK } from './helpers/prompt.helper.js';
import { GEMINI_RESPONSE_SCHEMA } from './helpers/story_schema.js';
dotenv.config();

// Models configuration with fallback priority (override with GEMINI_MODELS="model-a,model-b").
// Checked against the API on 2026-10-07 (`node scripts/list_models.js` lists them and flags
// configured models that no longer exist). Gemma 3 models are no longer served.
const DEFAULT_MODELS = [
  'gemma-4-31b-it', // Latest and most capable Gemma model
  'gemma-4-26b-a4b-it',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
];

// Models that support Audio Generation (override with GEMINI_AUDIO_MODELS)
const DEFAULT_AUDIO_MODELS = [
  'gemini-2.5-flash-preview-tts', // Specialized TTS model (raw 24 kHz PCM)
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.8-flash-lite-tts',
];

const parseModelList = (value, fallback) => {
  const models = (value || '').split(',').map(m => m.trim()).filter(Boolean);
  return models.length > 0 ? models : fallback;
};

export const MODELS = parseModelList(process.env.GEMINI_MODELS, DEFAULT_MODELS);
export const AUDIO_MODELS = parseModelList(process.env.GEMINI_AUDIO_MODELS, DEFAULT_AUDIO_MODELS);

const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 180000;
const MAX_RETRIES_PER_MODEL = 2;
const RETRY_BASE_DELAY_MS = 2000;

// Output budget: a full week is 7 stories of up to ~1400 words each
const MAX_OUTPUT_TOKENS_SINGLE = 8192;
const MAX_OUTPUT_TOKENS_WEEK = 32768;

// Errors worth retrying on the same model (rate limit / transient server errors)
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
// Errors caused by the request or the key: switching model would not help
const FATAL_STATUSES = [400, 401, 403];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// What each model family accepts. Gemma models reject systemInstruction and JSON mode with a 400
// (fatal, so no fallback would happen): they get the instruction inline and JSON is asked by the prompt.
const MODEL_CAPABILITIES = [
  { prefix: 'gemma-', systemInstruction: false, jsonSchema: false },
  { prefix: 'gemini-', systemInstruction: true, jsonSchema: true }
];

export const getModelCapabilities = (model) =>
  MODEL_CAPABILITIES.find(c => model.startsWith(c.prefix)) || { systemInstruction: false, jsonSchema: false };

/**
 * Builds the generateContent body for a story, adapted to what the model supports.
 * @param {string} model - Model id.
 * @param {string} systemInstruction - System instruction.
 * @param {string} prompt - User prompt.
 * @param {number} maxOutputTokens - Output budget.
 * @returns {Object} Request body.
 */
export const buildStoryRequestBody = (model, systemInstruction, prompt, maxOutputTokens) => {
  const capabilities = getModelCapabilities(model);
  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: capabilities.systemInstruction ? prompt : `${systemInstruction}\n\n${prompt}` }]
    }],
    generationConfig: { maxOutputTokens, temperature: 0.9 }
  };
  if (capabilities.systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (capabilities.jsonSchema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = GEMINI_RESPONSE_SCHEMA;
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
  }

  /**
   * Calls generateContent, falling back through the given models.
   * - 400/401/403: fatal (bad request or key), no fallback, real API message surfaced.
   * - 429/5xx: retried on the same model with exponential backoff, then next model.
   * - 404, network errors, timeouts: next model.
   * @param {string[]} models - Models in priority order.
   * @param {Object|Function} body - generateContent request body, or a function (model) => body.
   * @param {string} label - Label for logs.
   * @returns {Promise<{result: Object, model: string}>} Parsed JSON response and the model that answered.
   */
  async _generateWithFallback(models, body, label) {
    const failures = [];

    for (const model of models) {
        for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
            let response;
            try {
                console.log(`[Gemini] ${label}: model ${model} (attempt ${attempt + 1})`);
                response = await fetch(`${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(typeof body === 'function' ? body(model) : body),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
                });
            } catch (error) {
                const reason = error.name === 'TimeoutError' ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : error.message;
                console.error(`[Gemini] ${label}: network error on ${model}: ${reason}`);
                failures.push(`${model}: ${reason}`);
                break; // next model
            }

            if (response.ok) {
                return { result: await response.json(), model };
            }

            const errorText = await response.text().catch(() => '');
            let apiMessage = errorText;
            try { apiMessage = JSON.parse(errorText)?.error?.message || errorText; } catch (e) { /* plain text */ }
            console.warn(`[Gemini] ${label}: error ${response.status} on ${model}: ${apiMessage}`);

            if (FATAL_STATUSES.includes(response.status)) {
                throw new GeminiFatalError(`Gemini API error ${response.status}: ${apiMessage}`, response.status);
            }

            if (RETRYABLE_STATUSES.includes(response.status) && attempt < MAX_RETRIES_PER_MODEL) {
                await wait(RETRY_BASE_DELAY_MS * 2 ** attempt);
                continue;
            }

            failures.push(`${model}: ${response.status}`);
            break; // next model
        }
    }

    throw new Error(`All Gemini/Gemma models failed (${failures.join(', ')}).`);
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
   * @returns {Promise<{text: string, model: string, finishReason: string, truncated: boolean}>} The generated story text and metadata.
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

    const startTime = Date.now();
    try {
        const { result, model } = await this._generateWithFallback(
            MODELS,
            (model) => buildStoryRequestBody(model, systemInstruction, prompt, maxOutputTokens),
            'Story'
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
        logger.ai('Gemini', 'Story', { theme, age, day, numCharacters, charNames, seriesName, promptLength: prompt.length }, { text, model, finishReason }, { duration });

        return { text, model, finishReason, truncated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Story-Error', { theme, age, day, promptLength: prompt.length }, { error: error.message }, { duration, success: false });
        throw error;
    }
  }

  /**
   * Generates audio for a given text using Gemini.
   * @param {string} text - The text to convert to audio.
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string, extension: string}>} The playable audio file, its mime type and extension.
   */
  async generateAudio(text) {
    if (!this.apiKey) {
      throw new Error("Gemini API Key not configured.");
    }

    const startTime = Date.now();
    try {
        const { result, model } = await this._generateWithFallback(AUDIO_MODELS, {
            contents: [{
                role: "user",
                parts: [{ text: `Please read the following story aloud with a narrator's voice suitable for children:\n\n${text}` }]
            }],
            generationConfig: {
                responseModalities: ["AUDIO"]
            }
        }, 'Audio');

        const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('audio/'));

        if (!audioPart?.inlineData?.data) {
            logger.ai('Gemini', 'Audio-Error', { textLength: text.length }, { error: 'No audio content in response' }, { duration: Date.now() - startTime, success: false });
            console.error("No audio content in response:", JSON.stringify(result, null, 2));
            throw new Error("No audio generated by Gemini.");
        }

        const rawAudioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
        const audio = toPlayableAudio(rawAudioBuffer, audioPart.inlineData.mimeType);

        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Audio', { textLength: text.length }, { audioSize: audio.audioBuffer.length, model, sourceMimeType: audioPart.inlineData.mimeType }, { duration });

        return audio;
    } catch (error) {
         const duration = Date.now() - startTime;
         logger.ai('Gemini', 'Audio-Error', { textLength: text.length }, { error: error.message }, { duration, success: false });
         throw error;
    }
  }
}

export const geminiService = new GeminiService();
