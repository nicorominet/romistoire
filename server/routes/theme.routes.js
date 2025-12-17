import express from 'express';
import * as themeController from '../controllers/theme.controller.js';

const router = express.Router();

/**
 * GET /api/themes
 * Retrieve all themes.
 * @param {string} [req.query.search] - Optional search query.
 * @returns {Array} List of themes.
 */
router.get('/', themeController.getThemes);

/**
 * GET /api/themes/:id/stories
 * Retrieve stories associated with a specific theme.
 * @param {string} req.params.id - Theme ID.
 * @returns {Array} List of stories.
 */
router.get('/:id/stories', themeController.getStoriesByTheme);

/**
 * POST /api/themes
 * Create a new theme.
 * @param {Object} req.body - Theme data.
 * @returns {Object} The created theme.
 */
router.post('/', themeController.createTheme);

/**
 * PUT /api/themes/:id
 * Update an existing theme.
 * @param {string} req.params.id - Theme ID.
 * @param {Object} req.body - Updated theme data.
 * @returns {Object} The updated theme.
 */
router.put('/:id', themeController.updateTheme);

/**
 * DELETE /api/themes/:id
 * Delete a theme.
 * @param {string} req.params.id - Theme ID.
 * @returns {Object} Success status.
 */
router.delete('/:id', themeController.deleteTheme);

/**
 * POST /api/themes/merge-duplicates
 * Merge duplicate themes based on name similarity.
 * @returns {Object} Merge result statistics.
 */
router.post('/merge-duplicates', themeController.mergeDuplicates);

/**
 * PUT /api/themes/:themeId/stories
 * Update theme associations for stories.
 * @param {string} req.params.themeId - Theme ID.
 * @param {Object} req.body - Update data.
 * @returns {Object} Success status.
 */
router.put('/:themeId/stories', themeController.updateStoriesTheme);

export default router;
