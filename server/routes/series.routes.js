import express from 'express';
import * as seriesController from '../controllers/series.controller.js';

const router = express.Router();

/**
 * GET /api/series
 * Retrieve all series.
 * @returns {Array} List of series.
 */
router.get('/', seriesController.getSeries);

/**
 * GET /api/series/:id/stats
 * Retrieve statistics for a specific series.
 * @param {string} req.params.id - Series ID.
 * @returns {Object} Series statistics.
 */
router.get('/:id/stats', seriesController.getSeriesStats);

/**
 * POST /api/series
 * Create a new series.
 * @param {Object} req.body - Series data.
 * @returns {Object} The created series.
 */
router.post('/', seriesController.createSeries);

/**
 * PUT /api/series/:id
 * Update an existing series.
 * @param {string} req.params.id - Series ID.
 * @param {Object} req.body - Updated series data.
 * @returns {Object} The updated series.
 */
router.put('/:id', seriesController.updateSeries);

/**
 * DELETE /api/series/:id
 * Delete a series.
 * @param {string} req.params.id - Series ID.
 * @returns {Object} Success status.
 */
router.delete('/:id', seriesController.deleteSeries);

/**
 * POST /api/series/:id/stories/batch
 * Batch add/remove stories to/from a series.
 * @param {string} req.params.id - Series ID.
 * @param {Object} req.body - Batch operation data (action, storyIds).
 * @returns {Object} Success status.
 */
router.post('/:id/stories/batch', seriesController.batchUpdateStories);

export default router;
