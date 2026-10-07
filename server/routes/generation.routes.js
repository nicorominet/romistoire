import express from 'express';
import { generateAIStory, getOllamaModels } from '../controllers/story.controller.js';

const router = express.Router();

// Route: /api/generate/story
/**
 * POST /api/generate/story
 * Generate a story using AI based on provided parameters.
 * @param {Object} req.body - Generation parameters (theme, ageGroup, etc.).
 * @returns {Object} The generated story object.
 */
router.post('/story', generateAIStory);

// Route: /api/generate/ollama/models
router.get('/ollama/models', getOllamaModels);

export default router;
