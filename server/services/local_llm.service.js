import dotenv from 'dotenv';
import { logger } from './logger.service.js';
import { PromptHelper } from './helpers/prompt.helper.js';
import { JSON_SCHEMA } from './helpers/story_schema.js';
dotenv.config();

/**
 * Service for interacting with Local LLM via Ollama.
 */
class LocalLLMService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'gemma4:e2b'; // Default model, can be configured
    // Local generation is slow (a full week can take minutes): generous default
    this.timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || 600000;
  }

  /**
   * Generates a story using the local Ollama model.
   * @param {Object} params - Generation parameters.
   * @returns {Promise<{text: string}>} Generated story text.
   */
  async generateStory(params) {
    const { theme, age, day, numCharacters, charNames, seriesName, model } = params;
    
    // Use shared prompt helper
    const system = PromptHelper.buildSystemInstruction();
    const prompt = PromptHelper.buildStoryPrompt(params);

    // Use requested model or default to env/config
    const targetModel = model || this.model;

    // Let's implement the API call.
    const startTime = Date.now();
    try {
        console.log(`[LocalLLM] Generating story with model ${targetModel}...`);
        console.log(`[LocalLLM] Prompt length: ${prompt.length} chars`);
        
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: targetModel,
                system,
                prompt: prompt,
                format: JSON_SCHEMA, // Constrained JSON output (Ollama >= 0.5)
                stream: false, // We want full response
                options: {
                    temperature: 0.8,
                    num_ctx: 10000, // Ensure large context for week generation
                    num_predict: -1 // Infinite generation (until stop token)
                }
            }),
            signal: AbortSignal.timeout(this.timeoutMs)
        });

        if (!response.ok) {
            throw new Error(`Ollama API Error: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.response) throw new Error(`Empty response from Ollama (model ${targetModel}).`);

        const finishReason = data.done_reason || 'UNKNOWN';
        const truncated = finishReason === 'length';
        
        const duration = Date.now() - startTime;
        logger.ai('Ollama', 'Story', { theme, age, day, numCharacters, charNames, seriesName, model: targetModel }, { text: data.response, finishReason }, { duration });

        return { text: data.response, model: targetModel, finishReason, truncated };

    } catch (error) {
        if (error.name === 'TimeoutError') {
            error = new Error(`Ollama did not answer within ${Math.round(this.timeoutMs / 1000)}s (model ${targetModel}).`);
        }
        console.error('[LocalLLM] Error:', error);
        const duration = Date.now() - startTime;
        logger.ai('Ollama', 'Story-Error', { theme, age, day, model: targetModel }, { error: error.message }, { duration, success: false });
        throw error;
    }
  }

  /**
   * Lists available models from the local Ollama instance.
   * @returns {Promise<string[]>} List of model names.
   */
  async listModels() {
      try {
          const response = await fetch(`${this.baseUrl}/api/tags`);
          if (!response.ok) {
              throw new Error(`Ollama API Error: ${response.statusText}`);
          }
          const data = await response.json();
          return data.models.map(m => m.name);
      } catch (error) {
          console.error('[LocalLLM] Failed to list models:', error);
          logger.ai('Ollama', 'ListModels-Error', {}, { error: error.message }, { success: false });
          return [];
      }
  }

  // Audio generation logic (Not supported text-only local LLM)
  async generateAudio(text) {
      console.warn("Local LLM does not support audio generation directly. Using dummy or fallback?");
      throw new Error("Local Audio generation not yet implemented. Please use Cloud provider for Audio or configure local TTS.");
  }
}

export const localLLMService = new LocalLLMService();
