
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { logger } from '../config/logger.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, '../debug/logs.jsonl');

/**
 * POST /api/logs
 * Ingest logs from the client.
 * @param {Object} req.body - Log entry (category, message, data, level).
 * @returns {Object} Success status.
 */
router.post('/', (req, res) => {
    const { category, message, data, level } = req.body;
    
    // Basic validation
    if (!category || !message) {
        return res.status(400).json({ error: 'Missing category or message' });
    }

    // Use our server logger to write to the file
    // We add a specific category prefix or flag to know it came from Client
    logger[level?.toLowerCase() || 'info'](category, message, data);

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
 * List available access log files.
 * @returns {Array} List of access log file objects with metadata.
 */
router.get('/access/files', (req, res) => {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
        return res.json([]);
    }
    
    fs.readdir(logsDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to list logs' });
        
        const logFiles = files
            .filter(f => f.startsWith('access-') && f.endsWith('.log'))
            .map(f => {
                const stat = fs.statSync(path.join(logsDir, f));
                return {
                    filename: f,
                    date: f.replace('access-', '').replace('.log', ''),
                    size: stat.size,
                    mtime: stat.mtime
                };
            })
            .sort((a, b) => b.mtime - a.mtime); // Newest first
            
        res.json(logFiles);
    });
});

/**
 * GET /api/logs/access/:filename
 * Read content of a specific access log file.
 * @param {string} req.params.filename - The filename of the log to read.
 * @returns {Array} parsed log entries.
 */
router.get('/access/:filename', (req, res) => {
    const filename = req.params.filename;
    // Basic security check to prevent directory traversal
    if (!filename.match(/^access-\d{4}-\d{2}-\d{2}\.log$/)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(__dirname, '../logs', filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read file' });
        // Parse JSONL to array
        const lines = data.split('\n').filter(l => l.trim());
        const entries = lines.map(line => {
            try { return JSON.parse(line); } catch(e) { return { message: line }; }
        });
        res.json(entries.reverse()); // Newest first
    });
});

export default router;
