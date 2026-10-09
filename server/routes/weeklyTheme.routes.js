import express from 'express';
import * as weeklyThemeController from '../controllers/weeklyTheme.controller.js';

const router = express.Router();

/**
 * GET /api/weekly-themes
 * Topics of the configured weeks: [{ week_number, theme_name, theme_description }].
 */
router.get('/', weeklyThemeController.getWeeklyThemes);

/**
 * POST /api/weekly-themes
 * Batch update: [{ week_number, theme_name, theme_description? }] (legacy).
 */
router.post('/', weeklyThemeController.updateWeeklyThemes);

/**
 * PUT /api/weekly-themes/:week
 * Set the topic of a week (1-53): { name, description? }.
 */
/**
 * POST /api/weekly-themes/suggest
 * AI topic suggestions for the given weeks (not saved).
 * @param {number[]} req.body.weeks
 */
router.post('/suggest', weeklyThemeController.suggestWeekThemes);

router.put('/:week', weeklyThemeController.setWeekTheme);

/**
 * DELETE /api/weekly-themes/:week
 * Remove the topic of a week (any week, so legacy weeks > 53 can be cleaned up).
 */
router.delete('/:week', weeklyThemeController.clearWeekTheme);

export default router;
