import express from 'express';
import { handleError } from '../middleware/error.middleware.js';
import { generationJobService } from '../services/generation_job.service.js';
// Importing the worker wires it to the job service (a created or resumed job wakes it up)
import '../services/generation_worker.js';

const router = express.Router();

/** Wraps an async handler with the common error handling. */
const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * POST /api/generation-jobs/estimate
 * What a job would generate: units, requests, estimated duration, quota warning. Creates nothing.
 * @param {Object} req.body - { weeks, ages, day, numCharacters, charNames, seriesName, provider, model, skipExisting }
 */
router.post('/estimate', handle(req => generationJobService.estimate(req.body)));

/**
 * GET /api/generation-jobs/coverage
 * Stories per (week, age) cell and the topic of each week.
 */
router.get('/coverage', handle(() => generationJobService.coverage()));

/**
 * GET /api/generation-jobs
 * Latest jobs, newest first (without their log).
 */
router.get('/', handle(() => generationJobService.list()));

/**
 * POST /api/generation-jobs
 * Queues a job (same body as /estimate). 400 when there is nothing to generate.
 */
router.post('/', handle(req => generationJobService.create(req.body)));

/**
 * GET /api/generation-jobs/:id
 * A job with its units and log.
 */
router.get('/:id', handle(req => generationJobService.get(req.params.id)));

router.post('/:id/pause', handle(req => generationJobService.pause(req.params.id)));
router.post('/:id/resume', handle(req => generationJobService.resume(req.params.id)));
router.post('/:id/cancel', handle(req => generationJobService.cancel(req.params.id)));
router.post('/:id/retry-failed', handle(req => generationJobService.retryFailed(req.params.id)));

/**
 * POST /api/generation-jobs/:id/validate
 * Marks every story of the job as reviewed.
 */
router.post('/:id/validate', handle(req => generationJobService.validate(req.params.id)));

/**
 * DELETE /api/generation-jobs/:id/stories
 * Deletes the stories written by the job (the job stays in the history).
 */
router.delete('/:id/stories', handle(req => generationJobService.deleteStories(req.params.id)));

export default router;
