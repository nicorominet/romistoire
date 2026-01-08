
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '../debug');
const LOG_FILE = path.join(LOG_DIR, 'logs.jsonl');

/**
 * Appends a log entry to the JSONL file.
 * @param {string} category - Category of log (DB, API, SYSTEM, etc.)
 * @param {string} message - Human readable message
 * @param {object} data - Structured data payload
 * @param {string} level - Log level (INFO, WARN, ERROR)
 */
export function log(category, message, data = {}, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        level,
        category,
        message,
        data
    };

    const line = JSON.stringify(entry) + '\n';

    // Ensure directory exists (sync check is fast enough for low freq logging, 
    // but better to rely on startup creation. We added mkdir in previous step)
    
    fs.appendFile(LOG_FILE, line, (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });

    // Also log to console in dev
    if (process.env.NODE_ENV !== 'production') {
        const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[36m';
        console.log(`${color}[${category}] ${message}\x1b[0m`);
    }
}

export const logger = {
    info: (cat, msg, data) => log(cat, msg, data, 'INFO'),
    warn: (cat, msg, data) => log(cat, msg, data, 'WARN'),
    error: (cat, msg, data) => log(cat, msg, data, 'ERROR'),
};
