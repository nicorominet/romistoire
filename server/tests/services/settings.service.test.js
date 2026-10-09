// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { settingsService, defaultProvider, DEFAULT_SETTINGS } from '../../services/settings.service.js';
import { geminiConfig, buildStoryRequestBody, MODELS } from '../../services/gemini.service.js';
import { localLLMService, OLLAMA_DEFAULTS } from '../../services/local_llm.service.js';
import { ValidationError } from '../../middleware/error.middleware.js';

describe('SettingsService', () => {
  const envProvider = process.env.AI_PROVIDER;

  beforeEach(() => settingsService.reset());
  afterEach(() => {
    settingsService.reset();
    if (envProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = envProvider;
  });

  it('should start from the defaults (nothing set: .env applies)', () => {
    expect(settingsService.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('should merge a partial update and ignore unknown keys', () => {
    const result = settingsService.update({ ai: { defaultProvider: 'local', apiKey: 'nope' }, other: 1 });

    expect(result.ai.defaultProvider).toBe('local');
    expect(result.ai).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('other');
    expect(result.storage).toEqual(DEFAULT_SETTINGS.storage);
  });

  it('should reject invalid values with every field in error, and save nothing', () => {
    let error;
    try {
      settingsService.update({
        ai: { defaultProvider: 'openai', creativity: 5, ollamaBaseUrl: 'file:///etc/passwd', geminiModels: ['ok', 'bad name!'] },
        storage: { autoBackup: { keep: 0 } }
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.details.fields).toHaveLength(5);
    expect(settingsService.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('should normalize values (URL without trailing slash, model list without duplicates)', () => {
    const { ai } = settingsService.update({ ai: { ollamaBaseUrl: 'http://192.168.1.10:11434/', geminiModels: [' m-1 ', 'm-1', 'm-2'] } });

    expect(ai.ollamaBaseUrl).toBe('http://192.168.1.10:11434');
    expect(ai.geminiModels).toEqual(['m-1', 'm-2']);
  });

  it('should go back to the .env value when a setting is cleared with null', () => {
    settingsService.update({ ai: { ollamaModel: 'llama3:8b' } });
    expect(localLLMService.model).toBe('llama3:8b');

    settingsService.update({ ai: { ollamaModel: null } });
    expect(localLLMService.model).toBe(OLLAMA_DEFAULTS.model);
  });

  it('defaultProvider: settings, then AI_PROVIDER, then Gemini', () => {
    delete process.env.AI_PROVIDER;
    expect(defaultProvider()).toBe('gemini');

    process.env.AI_PROVIDER = 'local';
    expect(defaultProvider()).toBe('local');

    settingsService.update({ ai: { defaultProvider: 'gemini' } });
    expect(defaultProvider()).toBe('gemini');
  });

  it('should drive the Gemini models, timeouts and temperature', () => {
    expect(geminiConfig().models).toEqual(MODELS);
    expect(buildStoryRequestBody('gemini-x', 'sys', 'prompt', 100).generationConfig.temperature).toBe(0.9);

    settingsService.update({ ai: { geminiModels: ['gemini-a'], geminiTimeoutMs: 30000, creativity: 0.4 } });

    expect(geminiConfig()).toMatchObject({ models: ['gemini-a'], timeoutMs: 30000, creativity: 0.4 });
    expect(buildStoryRequestBody('gemini-x', 'sys', 'prompt', 100).generationConfig.temperature).toBe(0.4);
  });
});
