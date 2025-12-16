import express from 'express';
import * as weeklyThemeController from '../controllers/weeklyTheme.controller.js';

const router = express.Router();

router.get('/', weeklyThemeController.getWeeklyThemes);
router.post('/', weeklyThemeController.updateWeeklyThemes);

export default router;
