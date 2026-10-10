import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../config/env.config.js';
import { ValidationError } from '../middleware/error.middleware.js';
import { PACES, STYLES, VOICE_NAMES } from './helpers/voice.helper.js';

// Settings > AI generation / Storage. Gitignored: it may hold local URLs.
const SETTINGS_FILE = path.join(ENV_CONFIG.PROJECT_ROOT, 'server', 'config', 'app-settings.json');
// Test runs never read nor write the real settings file
const PERSIST = !process.env.VITEST;

/**
 * null = not set in the settings page: the .env variable (or the code default) applies.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  ai: {
    defaultProvider: null,     // 'gemini' | 'local'
    geminiModels: null,        // fallback order
    geminiAudioModels: null,
    ollamaBaseUrl: null,
    ollamaModel: null,
    creativity: null,          // temperature, 0.2 - 1.2
    geminiTimeoutMs: null,     // one story
    geminiWeekTimeoutMs: null, // a whole week in one answer
    ollamaTimeoutMs: null,
    // Reading voice of the audio stories (null = code default, see voice.helper DEFAULT_AUDIO)
    audio: { voice: null, characterVoice: null, style: null, pace: null, multiSpeaker: null }
  },
  storage: {
    autoBackup: { enabled: false, frequency: 'daily', keep: 5 },
    orphanPurge: { enabled: true, maxAgeHours: 24 },
    logRetentionDays: 30
  }
});

export const PROVIDERS = ['gemini', 'local'];
export const BACKUP_FREQUENCIES = ['daily', 'weekly'];
const MODEL_NAME_RE = /^[\w.:\-/]+$/;

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Field validators: (value) => normalized value, or throws a message. null always means "not set". */
const nullable = (check) => (value) => (value === null ? null : check(value));

const oneOf = (choices) => (value) => {
  if (!choices.includes(value)) throw `must be one of ${choices.join(', ')}`;
  return value;
};

const integer = (min, max) => (value) => {
  if (!Number.isInteger(value) || value < min || value > max) throw `must be an integer between ${min} and ${max}`;
  return value;
};

const number = (min, max) => (value) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) throw `must be a number between ${min} and ${max}`;
  return Math.round(value * 100) / 100;
};

const bool = (value) => {
  if (typeof value !== 'boolean') throw 'must be a boolean';
  return value;
};

const modelList = (value) => {
  if (!Array.isArray(value)) throw 'must be a list of model names';
  const models = [...new Set(value.map((m) => String(m).trim()).filter(Boolean))];
  if (models.length === 0) throw 'must contain at least one model';
  if (models.some((m) => !MODEL_NAME_RE.test(m) || m.length > 100)) throw 'contains an invalid model name';
  return models;
};

const modelName = (value) => {
  const name = String(value).trim();
  if (!name || !MODEL_NAME_RE.test(name) || name.length > 100) throw 'is not a valid model name';
  return name;
};

const httpUrl = (value) => {
  let url;
  try { url = new URL(String(value).trim()); } catch (e) { throw 'is not a valid URL'; }
  if (!['http:', 'https:'].includes(url.protocol)) throw 'must start with http:// or https://';
  return url.toString().replace(/\/+$/, '');
};

const SCHEMA = {
  ai: {
    defaultProvider: nullable(oneOf(PROVIDERS)),
    geminiModels: nullable(modelList),
    geminiAudioModels: nullable(modelList),
    ollamaBaseUrl: nullable(httpUrl),
    ollamaModel: nullable(modelName),
    creativity: nullable(number(0.2, 1.2)),
    geminiTimeoutMs: nullable(integer(10000, 900000)),
    geminiWeekTimeoutMs: nullable(integer(10000, 1800000)),
    ollamaTimeoutMs: nullable(integer(10000, 3600000)),
    audio: {
      voice: nullable(oneOf(VOICE_NAMES)),
      characterVoice: nullable(oneOf(VOICE_NAMES)),
      style: nullable(oneOf(STYLES)),
      pace: nullable(oneOf(PACES)),
      multiSpeaker: nullable(bool)
    }
  },
  storage: {
    autoBackup: { enabled: bool, frequency: oneOf(BACKUP_FREQUENCIES), keep: integer(1, 50) },
    orphanPurge: { enabled: bool, maxAgeHours: integer(1, 24 * 30) },
    logRetentionDays: integer(1, 365)
  }
};

/**
 * Applies `values` on top of `base` following `schema`. Unknown keys are ignored.
 * @param {string[]} errors - Collects "path: message" for invalid values.
 */
const merge = (schema, base, values, errors, prefix = '') => {
  const result = { ...base };
  if (!values || typeof values !== 'object' || Array.isArray(values)) return result;
  for (const [key, rule] of Object.entries(schema)) {
    if (!(key in values)) continue;
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (typeof rule === 'function') {
      try {
        result[key] = rule(values[key]);
      } catch (message) {
        errors.push(`${fieldPath} ${message}`);
      }
    } else {
      result[key] = merge(rule, base[key], values[key], errors, fieldPath);
    }
  }
  return result;
};

const loadSettings = () => {
  if (!PERSIST || !fs.existsSync(SETTINGS_FILE)) return clone(DEFAULT_SETTINGS);
  try {
    // A hand-edited file with a bad value keeps the defaults for that value only
    return merge(SCHEMA, clone(DEFAULT_SETTINGS), JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')), []);
  } catch (error) {
    console.error('[Settings] Unreadable settings file, using defaults:', error.message);
    return clone(DEFAULT_SETTINGS);
  }
};

class SettingsService {
  constructor() {
    this.settings = loadSettings();
  }

  /** Current settings (copy). */
  get() {
    return clone(this.settings);
  }

  /** AI settings, read on every call by the AI services. */
  get ai() {
    return this.settings.ai;
  }

  /** Storage settings, read by the maintenance task. */
  get storage() {
    return this.settings.storage;
  }

  /**
   * Validates and saves a partial update.
   * @param {Object} values - e.g. { ai: { defaultProvider: 'local' } }.
   * @returns {Object} The new settings.
   * @throws {ValidationError} With every invalid field; nothing is saved then.
   */
  update(values) {
    const errors = [];
    const next = merge(SCHEMA, this.settings, values, errors);
    if (errors.length > 0) throw new ValidationError('Invalid settings', { fields: errors });
    this.settings = next;
    if (PERSIST) fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
    return this.get();
  }

  /** Back to the defaults (tests). */
  reset() {
    this.settings = clone(DEFAULT_SETTINGS);
  }
}

export const settingsService = new SettingsService();

/**
 * Provider used when a request does not name one: settings page, then AI_PROVIDER, then Gemini.
 * @returns {'gemini'|'local'}
 */
export const defaultProvider = () =>
  settingsService.ai.defaultProvider ?? (PROVIDERS.includes(process.env.AI_PROVIDER) ? process.env.AI_PROVIDER : 'gemini');
