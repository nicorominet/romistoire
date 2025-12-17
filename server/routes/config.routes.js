import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '../config/log-config.json');

// Ensure config file exists
if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
        enableSqlLogging: true,
        enableAccessLogging: true,
        minLevel: 'INFO'
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
}

/**
 * GET /api/config/logs
 * Retrieve the current log configuration.
 * @returns {Object} The current configuration object.
 */
router.get('/config/logs', (req, res) => {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
             return res.json({ enableSqlLogging: true, enableAccessLogging: true, minLevel: 'INFO' });
        }
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read config' });
    }
});

/**
 * PUT /api/config/logs
 * Update the log configuration.
 * @param {Object} req.body - The new configuration object.
 * @returns {Object} Success status and the new configuration.
 */
router.put('/config/logs', (req, res) => {
    try {
        const newConfig = req.body;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
        res.json({ success: true, config: newConfig });
    } catch (error) {
        res.status(500).json({ error: 'Failed to write config' });
    }
});

export default router;
