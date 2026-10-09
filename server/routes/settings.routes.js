import express from 'express';
import * as settingsController from '../controllers/settings.controller.js';

const router = express.Router();

/**
 * GET /api/settings
 * Saved settings, defaults and the values in use. The Gemini API key is never returned.
 */
router.get('/', settingsController.getSettings);

/**
 * PUT /api/settings
 * Partial update, e.g. { ai: { defaultProvider: 'local' } }. 400 with `fields` when a value is invalid.
 */
router.put('/', settingsController.updateSettings);

/**
 * GET /api/settings/ai-status
 * Gemini models paused after an error, with the time they come back.
 */
router.get('/ai-status', settingsController.getAiStatus);

/**
 * GET /api/settings/quota-usage
 * Gemini quota use per model: today (Pacific quota day) and over the last ?days (1-30, default 7).
 */
router.get('/quota-usage', settingsController.getQuotaUsage);

/**
 * POST /api/settings/test-ollama
 * @param {string} [req.body.baseUrl] - Instance to test (default: the configured one).
 * @returns {{ok: boolean, baseUrl: string, models: string[], error?: string}}
 */
router.post('/test-ollama', settingsController.testOllama);

/**
 * GET /api/settings/storage-stats
 * Library counts, disk usage and backups summary.
 */
router.get('/storage-stats', settingsController.getStorageStats);

export default router;
