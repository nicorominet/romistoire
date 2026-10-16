
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { logger } from '../config/logger.js';
import { systemService } from '../services/system.service.js';
import { LIMITS } from '../middleware/rateLimit.middleware.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '../debug/logs.jsonl');

// What the client logger may write (src/lib/logger.ts sends batches of at most 50 entries)
const CLIENT_LEVELS = { INFO: 'info', WARN: 'warn', ERROR: 'error' };
const CATEGORY_RE = /^[A-Z][A-Z_]{0,63}$/;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_BATCH = 100;

/**
 * POST /api/logs
 * Ingest logs from the client: a known level, a category like "BATCH_LOGS", a short message.
 * The body size is capped in app.js; the rate in LIMITS.clientLogs.
 * @param {Object} req.body - Log entry (category, message, data, level).
 * @returns {Object} Success status.
 */
router.post('/', LIMITS.clientLogs, (req, res) => {
    const { category, message, data, level = 'INFO' } = req.body || {};
    const method = CLIENT_LEVELS[String(level).toUpperCase()];

    if (typeof category !== 'string' || !CATEGORY_RE.test(category)
        || typeof message !== 'string' || !message || message.length > MAX_MESSAGE_LENGTH || !method) {
        return res.status(400).json({ error: 'Invalid log entry' });
    }
    if (Array.isArray(data?.logs) && data.logs.length > MAX_BATCH) {
        return res.status(400).json({ error: `At most ${MAX_BATCH} entries per batch` });
    }

    logger[method](category, message, data);
    res.status(200).json({ success: true });
});

/**
 * GET /api/logs
 * Retrieve recent server logs.
 * @param {number} [req.query.limit=500] - Number of logs to return.
 * @returns {Array} List of log entries.
 */
router.get('/', async (req, res) => {
    const limit = parseInt(req.query.limit) || 500; // Limit logs specifically for debug console
    const logs = [];

    if (!fs.existsSync(LOG_FILE)) {
        return res.json([]);
    }

    // Efficiently read from end of file would be best, but for debug tool simply reading line by line is okay
    const fileStream = fs.createReadStream(LOG_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of rl) {
            try {
                if (line.trim()) {
                    logs.push(JSON.parse(line));
                }
            } catch (e) {
                // Ignore parse errors (corrupt lines)
            }
        }
        
        // Return only the last N logs, reversed (newest first)
        const recentLogs = logs.slice(-limit).reverse();
        res.json(recentLogs);

    } catch (err) {
        console.error('Error reading log file:', err);
        res.status(500).json({ error: 'Failed to read logs' });
    }
});

/**
 * DELETE /api/logs
 * Clear the current server log file.
 * @returns {Object} Success status.
 */
router.delete('/', (req, res) => {
    fs.writeFile(LOG_FILE, '', (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to clear logs' });
        }
        res.json({ success: true });
    });
});

/**
 * GET /api/logs/access/files
 * List available access and AI log files.
 * @returns {Array} List of access log file objects with metadata.
 */
router.get('/access/files', async (req, res) => {
    try {
        // Use systemService to get all logs (access and ai)
        const logFiles = await systemService.getLogsList();
        res.json(logFiles);
    } catch (error) {
        console.error('Error listing log files:', error);
        res.status(500).json({ error: 'Failed to list logs' });
    }
});

/**
 * GET /api/logs/access/:filename
 * Read content of a specific access/ai log file.
 * @param {string} req.params.filename - The filename of the log to read.
 * @returns {Array} parsed log entries.
 */
router.get('/access/:filename', async (req, res) => {
    const filename = req.params.filename;
    
    // Allow both access- and ai- log files
    if (!filename.match(/^(access|ai)-\d{4}-\d{2}-\d{2}\.log$/)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    try {
        const entries = await systemService.getLogContent(filename);
        res.json(entries);
    } catch (error) {
        if (error.message === 'Log file not found') {
            return res.status(404).json({ error: 'File not found' });
        }
        res.status(500).json({ error: 'Failed to read file' });
    }
});

export default router;
