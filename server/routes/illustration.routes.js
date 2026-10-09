import express from 'express';
import * as illustrationController from '../controllers/illustration.controller.js';

const router = express.Router();

/**
 * GET /api/illustrations/todo?locale=&weekNumber=&ageGroup=&hasImage=no|all
 * Stories to illustrate (without image by default), with their code and ready-to-paste prompt.
 */
router.get('/todo', illustrationController.getTodo);

/**
 * GET /api/illustrations/export?…&format=txt|json
 * Prompts file: txt to copy by hand, json for the Gemini Canvas tool.
 */
router.get('/export', illustrationController.exportPrompts);

/**
 * POST /api/illustrations/:storyId/prompt
 * Writes the illustration description of a story with the AI and saves it.
 */
router.post('/:storyId/prompt', illustrationController.generatePrompt);

/**
 * PUT /api/illustrations/:storyId/prompt { prompt }
 * Manual correction of the description.
 */
router.put('/:storyId/prompt', illustrationController.setPrompt);

export default router;
