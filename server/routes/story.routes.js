import express from 'express';
import * as storyController from '../controllers/story.controller.js';

const router = express.Router();

router.get('/', storyController.getStories);
router.get('/available-weeks', storyController.getAvailableWeeks);
router.get('/:id', storyController.getStoryById);
router.get('/:id/next', storyController.getNextStory);
router.get('/:id/previous', storyController.getPreviousStory);
router.get('/:id/neighbors', storyController.getStoryNeighbors);
router.post('/', storyController.createStory); // JSON Body
router.put('/:id', storyController.updateStory);
router.delete('/:id', storyController.deleteStory);
router.get('/:id/versions', storyController.getStoryVersions);
router.post('/:id/versions/:versionId', storyController.restoreStoryVersion);
router.delete('/:id/illustrations/:illustrationId', storyController.deleteIllustration);
router.get('/:id/illustrations', storyController.getStoryIllustrations);

// AI Generation - Techically not a "story" resource CRUD, but related.
// Maybe /api/generate/story -> mapped in app.js separately?
// Or /api/stories/generate ?
// The current frontend calls /api/generate/story.
// Keep it in mind. For now, let's export it here and we can mount it where we want.
// Reusing router instance might be tricky if paths differ.
// I will export a separate router or just mount this one at /api/stories.

export default router;
