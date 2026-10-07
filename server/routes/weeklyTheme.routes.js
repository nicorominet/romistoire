import express from 'express';
import * as weeklyThemeController from '../controllers/weeklyTheme.controller.js';

const router = express.Router();

/**
 * GET /api/weekly-themes
 * All configured weeks, with the linked theme (name, color, icon).
 */
router.get('/', weeklyThemeController.getWeeklyThemes);

/**
 * POST /api/weekly-themes
 * Batch update: [{ week_number, theme_id?, theme_name? }] (used by imports).
 */
router.post('/', weeklyThemeController.updateWeeklyThemes);

/**
 * PUT /api/weekly-themes/:week
 * Link one week to a theme: { themeId } or { themeName } (theme created if needed).
 */
router.put('/:week', weeklyThemeController.setWeekTheme);

/**
 * DELETE /api/weekly-themes/:week
 * Remove the theme of a week.
 */
router.delete('/:week', weeklyThemeController.clearWeekTheme);

export default router;
