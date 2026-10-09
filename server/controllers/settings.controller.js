import { handleError, ValidationError } from '../middleware/error.middleware.js';
import { settingsService, defaultProvider, DEFAULT_SETTINGS } from '../services/settings.service.js';
import { geminiConfig, geminiService, modelCooldowns, DEFAULT_MODELS, DEFAULT_AUDIO_MODELS } from '../services/gemini.service.js';
import { localLLMService, OLLAMA_DEFAULTS } from '../services/local_llm.service.js';
import { systemService } from '../services/system.service.js';
import { backupService } from '../services/backup.service.js';
import { aiUsageService } from '../services/ai_usage.service.js';

/**
 * Settings as saved, plus the values really in use (after the .env fallback). The Gemini key is never sent.
 */
const publicSettings = () => {
  const gemini = geminiConfig();
  return {
    settings: settingsService.get(),
    defaults: DEFAULT_SETTINGS,
    effective: {
      // Pre-selected on the create page (which always names its provider): Gemini until another one is chosen here
      defaultProvider: settingsService.ai.defaultProvider ?? 'gemini',
      // Used by API calls that name no provider (AI_PROVIDER in .env applies)
      apiDefaultProvider: defaultProvider(),
      geminiModels: gemini.models,
      geminiAudioModels: gemini.audioModels,
      geminiTimeoutMs: gemini.timeoutMs,
      geminiWeekTimeoutMs: gemini.weekTimeoutMs,
      ollamaBaseUrl: localLLMService.baseUrl,
      ollamaModel: localLLMService.model,
      ollamaTimeoutMs: localLLMService.timeoutMs
    },
    // What "Restore default" goes back to: the code defaults (the .env values apply when the setting is cleared)
    codeDefaults: {
      geminiModels: DEFAULT_MODELS,
      geminiAudioModels: DEFAULT_AUDIO_MODELS,
      ollama: OLLAMA_DEFAULTS
    },
    geminiKeyConfigured: Boolean(geminiService.apiKey)
  };
};

export const getSettings = (req, res) => {
  try {
    res.json(publicSettings());
  } catch (error) {
    handleError(res, error);
  }
};

export const updateSettings = (req, res) => {
  try {
    settingsService.update(req.body);
    res.json(publicSettings());
  } catch (error) {
    handleError(res, error);
  }
};

/** Gemini models paused after an error (quota, overload, timeout) and when they come back. */
export const getAiStatus = (req, res) => {
  try {
    res.json({ pausedModels: modelCooldowns.status() });
  } catch (error) {
    handleError(res, error);
  }
};

/** Quota use of the Gemini models (requests per minute and per day, 429 answers): ?days=1-30 (default 7). */
export const getQuotaUsage = async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, Number.parseInt(req.query.days, 10) || 7));
    res.json(await aiUsageService.usage({ days }));
  } catch (error) {
    handleError(res, error);
  }
};

/** Settings > AI > Test connection: lists the models of the given (or configured) Ollama instance. */
export const testOllama = async (req, res) => {
  try {
    const { baseUrl } = req.body || {};
    let url = localLLMService.baseUrl;
    if (baseUrl) {
      // Same validation as the saved setting: only http(s) URLs are queried
      try {
        url = new URL(String(baseUrl)).toString().replace(/\/+$/, '');
        if (!/^https?:/.test(url)) throw new Error();
      } catch (e) {
        throw new ValidationError('Invalid Ollama URL');
      }
    }
    try {
      const models = await localLLMService.fetchModels(url);
      res.json({ ok: true, baseUrl: url, models });
    } catch (error) {
      res.json({ ok: false, baseUrl: url, models: [], error: error.message });
    }
  } catch (error) {
    handleError(res, error);
  }
};

/** Settings > Storage dashboard: library counts, disk usage, backups. */
export const getStorageStats = async (req, res) => {
  try {
    const [stats, backups] = await Promise.all([systemService.getStats(), backupService.listBackups()]);
    res.json({
      ...stats,
      backups: {
        count: backups.length,
        bytes: backups.reduce((total, b) => total + b.size, 0),
        last: backups[0]?.createdAt ?? null
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};
