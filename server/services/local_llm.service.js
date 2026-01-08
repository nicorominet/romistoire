import dotenv from 'dotenv';
import { logger } from './logger.service.js';
import { PromptHelper } from './helpers/prompt.helper.js';
dotenv.config();

/**
 * Service for interacting with Local LLM via Ollama.
 */
class LocalLLMService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'gemma3:4b'; // Default model, can be configured
  }

  /**
   * Generates a story using the local Ollama model.
   * @param {Object} params - Generation parameters.
   * @returns {Promise<{text: string}>} Generated story text.
   */
  async generateStory(params) {
    const { theme, age, day, numCharacters, charNames, seriesName, previousChapter } = params;
    
    // Use shared prompt helper
    const prompt = PromptHelper.buildStoryPrompt(params);

    // Let's implement the API call.
    const startTime = Date.now();
    try {
        console.log(`[LocalLLM] Generating story with model ${this.model}...`);
        console.log(`[LocalLLM] Prompt length: ${prompt.length} chars`);
        
        // Ollama API call with longer timeout if needed?
        // Standard fetch with high num_ctx
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: prompt,
                stream: false, // We want full response
                options: {
                    temperature: 0.8,
                    num_ctx: 10000, // Ensure large context for week generation
                    num_predict: -1 // Infinite generation (until stop token)
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API Error: ${response.statusText}`);
        }

        const data = await response.json();
        
        const duration = Date.now() - startTime;
        logger.ai('Ollama', 'Story', { theme, age, day, numCharacters, charNames, seriesName, model: this.model }, { text: data.response }, { duration });

        return { text: data.response };

    } catch (error) {
        console.error('[LocalLLM] Error:', error);
        const duration = Date.now() - startTime;
        logger.ai('Ollama', 'Story-Error', { theme, age, day, model: this.model }, { error: error.message }, { duration, success: false });
        throw error;
    }
  }

  // Audio generation logic (Not supported text-only local LLM)
  async generateAudio(text) {
      console.warn("Local LLM does not support audio generation directly. Using dummy or fallback?");
      throw new Error("Local Audio generation not yet implemented. Please use Cloud provider for Audio or configure local TTS.");
  }
}

export const localLLMService = new LocalLLMService();
