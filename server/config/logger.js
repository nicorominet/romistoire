
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendLogLine } from '../lib/logFiles.js';
import { ENV_CONFIG } from './env.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Application log file, read at every write (tests point ENV_CONFIG.DEBUG_LOG_DIR elsewhere). */
export const debugLogFile = () => path.join(ENV_CONFIG.DEBUG_LOG_DIR, 'logs.jsonl');
// Beyond this size, the file is renamed logs.1.jsonl (replacing the previous one) by the hourly maintenance
export const DEBUG_LOG_MAX_BYTES = 20 * 1024 * 1024;
// Persisted settings (Settings > Network > Config): read at startup, rewritten on every update
const CONFIG_FILE = path.join(__dirname, 'log-config.json');

// From least to most severe: entries below config.minLevel are dropped
const LEVELS = ['INFO', 'WARN', 'ERROR'];

// SQL log off by default: one line per query, useful only while debugging
const DEFAULT_CONFIG = {
    enableSqlLogging: false,
    enableAccessLogging: true,
    minLevel: 'INFO'
};

/**
 * Keeps only the known config keys, with the expected types.
 * @param {Object} values - Raw values (request body, file content).
 * @returns {Object} Partial config.
 */
const pickConfig = (values = {}) => {
    const picked = {};
    if (typeof values.enableSqlLogging === 'boolean') picked.enableSqlLogging = values.enableSqlLogging;
    if (typeof values.enableAccessLogging === 'boolean') picked.enableAccessLogging = values.enableAccessLogging;
    if (LEVELS.includes(values.minLevel)) picked.minLevel = values.minLevel;
    return picked;
};

const loadConfig = () => {
    try {
        return { ...DEFAULT_CONFIG, ...pickConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))) };
    } catch (e) {
        return { ...DEFAULT_CONFIG };
    }
};

let config = loadConfig();

/**
 * Updates the logger configuration and persists it.
 * @param {Object} newConfig - New configuration values (unknown keys are ignored).
 * @returns {Object} Current configuration.
 */
export function updateLoggerConfig(newConfig) {
    config = { ...config, ...pickConfig(newConfig) };
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Failed to write log config:', err);
    }
    return config;
}

/**
 * Keeps the debug log under DEBUG_LOG_MAX_BYTES: the current file becomes logs.1.jsonl, a new one starts.
 * @returns {Promise<boolean>} true when the file was rotated.
 */
export async function rotateDebugLog(maxBytes = DEBUG_LOG_MAX_BYTES, file = debugLogFile()) {
    try {
        const { size } = await fs.promises.stat(file);
        if (size <= maxBytes) return false;
        await fs.promises.rename(file, file.replace(/\.jsonl$/, '.1.jsonl'));
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') return false;
        throw err;
    }
}

/**
 * Gets the current logger configuration.
 * @returns {Object} Current configuration.
 */
export function getLoggerConfig() {
    return config;
}

/** Categories whose INFO lines are written to the file only (the generation messages stay readable). */
const QUIET_CONSOLE = new Set(['DB', 'BATCH_LOGS']);

/**
 * Appends a log entry to the application log (server/debug/logs.jsonl).
 * @param {string} category - Category of log (DB, API, SYSTEM, etc.)
 * @param {string} message - Human readable message
 * @param {object} data - Structured data payload
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {{console?: boolean}} [options] - console: false when the caller prints its own line.
 */
export function log(category, message, data = {}, level = 'INFO', { console: toConsole = true } = {}) {
    // Filter based on configuration
    if (category === 'DB' && !config.enableSqlLogging) return;
    if ((category === 'API' || category === 'ACCESS') && !config.enableAccessLogging) return;
    if (LEVELS.indexOf(level) < LEVELS.indexOf(config.minLevel)) return;

    appendLogLine(debugLogFile(), { timestamp: new Date().toISOString(), level, category, message, data });

    // Also log to console in dev, except the routine of the chatty categories (one line per SQL query,
    // per batch of browser logs): they stay in the file, the console keeps their warnings and errors
    if (toConsole && process.env.NODE_ENV !== 'production' && !(level === 'INFO' && QUIET_CONSOLE.has(category))) {
        const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[36m';
        console.log(`${color}[${category}] ${message}\x1b[0m`);
    }
}

export const logger = {
    info: (cat, msg, data) => log(cat, msg, data, 'INFO'),
    warn: (cat, msg, data) => log(cat, msg, data, 'WARN'),
    error: (cat, msg, data) => log(cat, msg, data, 'ERROR'),
    updateConfig: updateLoggerConfig,
    getConfig: getLoggerConfig
};
