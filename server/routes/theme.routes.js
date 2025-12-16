import express from 'express';
import * as themeController from '../controllers/theme.controller.js';

const router = express.Router();

router.get('/', themeController.getThemes);
router.get('/:id/stories', themeController.getStoriesByTheme);
router.post('/', themeController.createTheme);
router.put('/:id', themeController.updateTheme);
router.delete('/:id', themeController.deleteTheme);
router.post('/merge-duplicates', themeController.mergeDuplicates);
router.put('/:themeId/stories', themeController.updateStoriesTheme);

export default router;
