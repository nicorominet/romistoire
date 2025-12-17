import { seriesService } from '../services/series.service.js';
import { handleError } from '../middleware/error.middleware.js';

export const getSeries = async (req, res) => {
    try {
        const series = await seriesService.findAll();
        res.json(series);
    } catch (error) {
        handleError(res, error);
    }
};

export const getSeriesStats = async (req, res) => {
    try {
        const stats = await seriesService.getStats(req.params.id);
        res.json(stats);
    } catch (error) {
        handleError(res, error);
    }
};

export const createSeries = async (req, res) => {
    try {
        if (!req.body.name) return res.status(400).json({ error: 'Missing name' });
        const series = await seriesService.create(req.body);
        res.status(201).json(series);
    } catch (error) {
        handleError(res, error);
    }
};

export const updateSeries = async (req, res) => {
    try {
        if (!req.body.name) return res.status(400).json({ error: 'Missing name' });
        const series = await seriesService.update(req.params.id, req.body);
        res.json(series);
    } catch (error) {
        handleError(res, error);
    }
};

export const deleteSeries = async (req, res) => {
    try {
        await seriesService.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        handleError(res, error);
    }
};

export const batchUpdateStories = async (req, res) => {
    try {
        const { storyIds, action } = req.body; // action: 'add' or 'remove'
        if (!storyIds || !Array.isArray(storyIds) || !action) {
            return res.status(400).json({ error: 'Invalid batch request' });
        }
        
        const result = await seriesService.batchUpdateStories(req.params.id, { storyIds, action });
        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
};
