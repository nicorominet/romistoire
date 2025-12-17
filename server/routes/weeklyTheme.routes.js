import express from 'express';
import * as weeklyThemeController from '../controllers/weeklyTheme.controller.js';

const router = express.Router();

/**
 * GET /api/weekly-themes
 * Retrieve all weekly themes.
 * @returns {Array} List of weekly themes.
 */
router.get('/', weeklyThemeController.getWeeklyThemes);

/**
 * POST /api/weekly-themes
 * Batch update weekly themes.
 * @param {Object} req.body - Array of weekly themes to update/create.
 * @returns {Object} Success status.
 */
router.post('/', weeklyThemeController.updateWeeklyThemes);

export default router;
