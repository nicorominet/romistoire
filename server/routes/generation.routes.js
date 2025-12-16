import express from 'express';
import { generateAIStory } from '../controllers/story.controller.js';

const router = express.Router();

// Route: /api/generate/story
router.post('/story', generateAIStory);

export default router;
