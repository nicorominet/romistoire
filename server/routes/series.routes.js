import express from 'express';
import * as seriesController from '../controllers/series.controller.js';
import { handleError } from '../middleware/error.middleware.js';
import { seriesCastService } from '../services/series_cast.service.js';
import { seriesAuditService } from '../services/series_audit.service.js';
import { defaultProvider } from '../services/settings.service.js';

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

// --- Bible of a framed series (generation tab "Génération cadrée") ---

/** Wraps an async handler with the common error handling. */
const handle = (fn, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await fn(req));
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * GET /api/series/:id/casts
 * Casts of a series and its old automatic character sheet.
 */
router.get('/:id/casts', handle(req => seriesCastService.list(req.params.id)));

/**
 * POST /api/series/:id/casts/validate
 * Cleans and checks a cast without saving it.
 * @param {Object} req.body - { cast, castId?, weeks? }
 * @returns {{cast: Object, errors: Object[], warnings: Object[]}}
 */
router.post('/:id/casts/validate', handle(req => seriesCastService.validate(req.params.id, req.body?.cast || {}, {
  castId: req.body?.castId || null,
  weeks: Array.isArray(req.body?.weeks) ? req.body.weeks.map(Number).filter(Number.isInteger) : []
})));

/** POST /api/series/:id/casts - 400 with { errors, warnings } when the cast is not consistent. */
router.post('/:id/casts', handle(req => seriesCastService.create(req.params.id, req.body || {}), 201));

router.put('/casts/:castId', handle(req => seriesCastService.update(req.params.castId, req.body || {})));
router.delete('/casts/:castId', handle(async req => ({ success: await seriesCastService.delete(req.params.castId) })));

/** Facts established by the weeks: proposed by the audit, approved or rejected by the user. */
router.get('/casts/:castId/facts', handle(req => seriesCastService.listFacts(req.params.castId)));
router.post('/casts/:castId/facts', handle(req => seriesCastService.addFact(req.params.castId, req.body || {}), 201));
router.patch('/facts/:factId', handle(req => seriesCastService.setFactStatus(req.params.factId, req.body?.status)));
router.delete('/facts/:factId', handle(async req => ({ success: await seriesCastService.deleteFact(req.params.factId) })));

/** Recap and audit of each week written with a cast. */
router.get('/casts/:castId/recaps', handle(req => seriesCastService.listRecaps(req.params.castId)));

/**
 * POST /api/series/casts/:castId/audit
 * Audits a week written with this cast again (local checks, and the AI unless useAI is false); saves its recap,
 * its audit and the facts it proposes.
 * @param {Object} req.body - { ageGroup, weekNumber, useAI? }
 */
router.post('/casts/:castId/audit', handle(req => seriesAuditService.auditStoredWeek({
  castId: req.params.castId,
  ageGroup: String(req.body?.ageGroup || ''),
  weekNumber: Number(req.body?.weekNumber),
  useAI: req.body?.useAI !== false,
  provider: defaultProvider()
})));

export default router;
