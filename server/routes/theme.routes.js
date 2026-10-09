import express from 'express';
import * as themeController from '../controllers/theme.controller.js';

const router = express.Router();

/**
 * GET /api/themes?search=&sort=name|usage|recent&needsReview=true&unused=true
 * Themes with their story count.
 */
router.get('/', themeController.getThemes);

/**
 * GET /api/themes/duplicates
 * Groups of themes that look like duplicates ("Océan" / "les océans"), most used first.
 */
router.get('/duplicates', themeController.getDuplicateThemes);

/**
 * GET /api/themes/:id/stories
 * Stories linked to a theme.
 */
router.get('/:id/stories', themeController.getStoriesByTheme);

/**
 * POST /api/themes
 * Create a theme { name, description?, color?, icon?, source? }.
 * 201 when created, 200 with `existing: true` when a theme with the same name exists.
 */
router.post('/', themeController.createTheme);

/**
 * POST /api/themes/merge
 * Merge { sourceIds: string[], targetId } into the target theme.
 */
router.post('/merge', themeController.mergeThemes);

/**
 * POST /api/themes/bulk-delete
 * Delete the unused themes among { ids }. Returns { deleted: ids, skipped: [{ id, storyCount }] }.
 */
router.post('/bulk-delete', themeController.deleteThemes);

/**
 * PUT /api/themes/:id
 * Partial update. 404 unknown theme, 409 { conflictWith } when the name is taken.
 */
router.put('/:id', themeController.updateTheme);

/**
 * DELETE /api/themes/:id?reassignTo=<themeId>
 * 409 { storyCount } when the theme is used and no replacement theme is given.
 */
router.delete('/:id', themeController.deleteTheme);

export default router;
