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
router.get('/:id', storyController.getStoryById);

/**
 * GET /api/stories/:id/next
 * Get the next story in the sequence.
 * @param {string} req.params.id - Current Story ID.
 * @returns {Object} The next story object.
 */
router.get('/:id/next', storyController.getNextStory);

/**
 * GET /api/stories/:id/previous
 * Get the previous story in the sequence.
 * @param {string} req.params.id - Current Story ID.
 * @returns {Object} The previous story object.
 */
router.get('/:id/previous', storyController.getPreviousStory);

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
 * GET /api/stories/:id/illustrations
 * Get all illustrations for a story.
 * @param {string} req.params.id - Story ID.
 * @returns {Array} List of illustrations.
 */
router.get('/:id/illustrations', storyController.getStoryIllustrations);

export default router;
