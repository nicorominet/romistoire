import express from 'express';
import * as storyController from '../controllers/story.controller.js';

const router = express.Router();

/**
 * GET /api/stories
 * Retrieve a paginated list of stories.
 * @param {Object} req.query - Pagination and filter parameters.
 * @returns {Object} Paginated list of stories.
 */
router.get('/', storyController.getStories);

/**
 * GET /api/stories/available-weeks
 * Get a list of week numbers that have associated stories.
 * @param {Object} req.query - Filter parameters (e.g., locale).
 * @returns {Array} List of week numbers.
 */
router.get('/available-weeks', storyController.getAvailableWeeks);

/**
 * GET /api/stories/:id
 * Retrieve a single story by ID.
 * @param {string} req.params.id - Story ID.
 * @returns {Object} The story object.
 */
/**
 * PUT /api/stories/review
 * Set the review status of several stories.
 * @param {string[]} req.body.ids - Story IDs.
 * @param {'to_review'|'validated'} req.body.status
 */
router.put('/review', storyController.setReviewStatus);

router.get('/:id', storyController.getStoryById);

/**
 * GET /api/stories/:id/neighbors
 * Get both adjacent stories (previous and next).
 * @param {string} req.params.id - Current Story ID.
 * @returns {Object} Object containing prev and next stories.
 */
router.get('/:id/neighbors', storyController.getStoryNeighbors);

/**
 * POST /api/stories
 * Create a new story.
 * @param {Object} req.body - Story data.
 * @returns {Object} The created story.
 */
router.post('/', storyController.createStory); // JSON Body

/**
 * PUT /api/stories/:id
 * Update an existing story.
 * @param {string} req.params.id - Story ID.
 * @param {Object} req.body - Updated story data.
 * @returns {Object} The updated story.
 */
router.put('/:id', storyController.updateStory);

/**
 * DELETE /api/stories/:id
 * Delete a story.
 * @param {string} req.params.id - Story ID.
 * @returns {Object} Success status.
 */
router.delete('/:id', storyController.deleteStory);

/**
 * GET /api/stories/:id/versions
 * Get version history for a story.
 * @param {string} req.params.id - Story ID.
 * @returns {Array} List of versions.
 */
router.get('/:id/versions', storyController.getStoryVersions);

/**
 * POST /api/stories/:id/versions/:versionId
 * Restore a specific story version.
 * @param {string} req.params.id - Story ID.
 * @param {string} req.params.versionId - Version ID to restore.
 * @returns {Object} Success status.
 */
router.post('/:id/versions/:versionId', storyController.restoreStoryVersion);

/**
 * DELETE /api/stories/:id/illustrations/:illustrationId
 * Delete an illustration from a story.
 * @param {string} req.params.id - Story ID.
 * @param {string} req.params.illustrationId - Illustration ID.
 * @returns {Object} Success status.
 */
router.delete('/:id/illustrations/:illustrationId', storyController.deleteIllustration);

/**
 * PUT /api/stories/:id/illustrations/order
 * Reorder the illustrations of a story (the first one is the cover used by cards and PDF).
 * @param {string} req.params.id - Story ID.
 * @param {string[]} req.body.illustrationIds - Illustration IDs in the new order.
 * @returns {Array} Illustrations in their new order.
 */
router.put('/:id/illustrations/order', storyController.reorderIllustrations);

/**
 * POST /api/stories/:id/audio
 * Generate audio for a story.
 * @param {string} req.params.id - Story ID.
 * @param {Object} [req.body] - Reading voice for this story only: { voice, characterVoice, style, pace, multiSpeaker }
 *   (missing fields: Settings > AI > reading voice). 400 with `fields` when a value is unknown.
 * @returns {Object} Audio path.
 */
router.post('/:id/audio', storyController.generateAIStoryAudio || storyController.generateAudio); // Using the exported name generateAudio

export default router;
