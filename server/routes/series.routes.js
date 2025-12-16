import express from 'express';
import * as seriesController from '../controllers/series.controller.js';

const router = express.Router();

router.get('/', seriesController.getSeries);
router.post('/', seriesController.createSeries);
router.put('/:id', seriesController.updateSeries);
router.delete('/:id', seriesController.deleteSeries);

export default router;
