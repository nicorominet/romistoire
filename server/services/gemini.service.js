import dotenv from 'dotenv';
import { logger } from './logger.service.js';
import { PromptHelper } from './helpers/prompt.helper.js';
dotenv.config();

// Models configuration with fallback priority
const MODELS = [
  'gemma-3-27b-it',
  'gemma-3-12b',
  'gemma-3-4b',
  'gemma-3-2b',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

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
 * Service for interacting with Google Gemini API to generate content.
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
  }

  /**
   * Generates a story based on provided parameters using Gemini/Gemma.
   * @param {Object} params - Generation parameters.
   * @param {string} params.theme - The weekly theme.
   * @param {string} params.age - The target age group (e.g., "4-6 ans").
   * @param {string} [params.day] - The day of the week or "Toute la semaine".
   * @param {number} [params.numCharacters] - Number of main characters.
   * @param {string} [params.charNames] - Names of main characters.
   * @param {string} [params.seriesName] - Name of the series if part of one.
   * @param {string} [params.previousChapter] - Previous story content.
   * @returns {Promise<{text: string}>} The generated story text and metadata.
   * @throws {Error} If API key is missing or generation fails.
   */
  async generateStory(params) {
    if (!this.apiKey) {
        throw new Error("Gemini API Key not configured.");
    }
    
    // Use shared prompt helper
    const prompt = PromptHelper.buildStoryPrompt(params);
    const { theme, age, day, numCharacters, charNames, seriesName } = params;

    const makeRequestWithRetry = async (retries = 3, delay = 2000, modelIndex = 0) => {
        const currentModel = MODELS[modelIndex];
        // If we ran out of models, throw final error
        if (!currentModel) {
             throw new Error("All Gemini/Gemma models are overloaded or unavailable.");
        }

        try {
            console.log(`Using AI Model: ${currentModel}`);
            const response = await fetch(`${this.baseUrl}/${currentModel}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                 console.warn(`AI Model Error ${response.status} on model ${currentModel}.`);
                 
                 // If error, try next model immediately (fallback strategy)
                 console.warn(`Switching to next model...`);
                 return makeRequestWithRetry(3, 2000, modelIndex + 1);
            }

            return response;
        } catch (error) {
             // Catch network errors and try next model
             console.error(`Network error on model ${currentModel}: ${error.message}`);
             return makeRequestWithRetry(3, 2000, modelIndex + 1);
        }
    };

    const startTime = Date.now();
    try {
        const response = await makeRequestWithRetry();

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("Empty response from Gemini");
        
        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Story', { theme, age, day, numCharacters, charNames, seriesName, promptLength: prompt.length }, { text, model: MODELS[0] }, { duration });

        return { text };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Story-Error', { theme, age, day, promptLength: prompt.length }, { error: error.message }, { duration, success: false });
        throw error;
    }
  }

  /**
   * Generates audio for a given text using Gemini.
   * @param {string} text - The text to convert to audio.
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string}>} The audio file buffer and mime type.
   */
  async generateAudio(text) {
    if (!this.apiKey) {
      throw new Error("Gemini API Key not configured.");
    }
    
    // Models that support Audio Generation
    const AUDIO_MODELS = [
        'gemini-2.5-flash-preview-tts', // Specialized TTS model
        'gemini-2.0-flash-exp', // Fallback
    ];

    const makeAudioRequestWithRetry = async (retries = 3, delay = 2000, modelIndex = 0) => {
        const currentModel = AUDIO_MODELS[modelIndex];
        if (!currentModel) {
             // If we exhausted models, throw a descriptive error
             throw new Error("All Audio models are unavailable or overloaded (Quota Exceeded). Please try again later.");
        }

        try {
            console.log(`Attempting audio generation with model: ${currentModel}`);
            const url = `${this.baseUrl}/${currentModel}:generateContent?key=${this.apiKey}`;
            
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: `Please read the following story aloud with a narrator's voice suitable for children:\n\n${text}` }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"]
                }
              })
            });

            if (!response.ok) {
                 const errText = await response.text();
                 console.error(`Audio Model Error ${response.status} on ${currentModel}: ${errText}`);
                 
                 // On error (429, 503, 404), switch to next model
                 console.warn(`Switching to next audio model...`);
                 return makeAudioRequestWithRetry(3, 2000, modelIndex + 1);
            }

            return response;
        } catch (error) {
             console.error(`Network error on audio model ${currentModel}: ${error.message}`);
             return makeAudioRequestWithRetry(3, 2000, modelIndex + 1);
        }
    };

    const startTime = Date.now();
    try {
        const response = await makeAudioRequestWithRetry();
        const result = await response.json();
        
        const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData && (p.inlineData.mimeType.startsWith('audio/') || p.inlineData.mimeType === 'audio/mp3'));
        
        if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
            logger.ai('Gemini', 'Audio-Error', { textLength: text.length }, { error: 'No audio content in response' }, { duration: Date.now() - startTime, success: false });
            console.error("No audio content in response:", JSON.stringify(result, null, 2));
            throw new Error("No audio generated by Gemini.");
        }

        const rawAudioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
        // Gemini 2.5 Flash Preview TTS returns raw PCM (24kHz, mono, 16-bit)
        // We need to add a WAV header to make it playable.
        const wavBuffer = addWavHeader(rawAudioBuffer);
        
        const duration = Date.now() - startTime;
        logger.ai('Gemini', 'Audio', { textLength: text.length }, { audioSize: wavBuffer.length }, { duration });

        return {
            audioBuffer: wavBuffer,
            mimeType: 'audio/wav'
        };
    } catch (error) {
         const duration = Date.now() - startTime;
         logger.ai('Gemini', 'Audio-Error', { textLength: text.length }, { error: error.message }, { duration, success: false });
         throw error;
    }
  }
}

export const geminiService = new GeminiService();
