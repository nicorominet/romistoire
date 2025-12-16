import { themeService } from '../services/theme.service.js';
import { handleError } from '../middleware/error.middleware.js';

export const getThemes = async (req, res) => {
    try {
        const filters = {
            search: req.query.search,
            age_group: req.query.age_group,
            series_id: req.query.series_id
        };
        const themes = await themeService.findAll(req.language, filters);
        res.json(themes);
    } catch (error) {
        handleError(res, error);
    }
};

export const getStoriesByTheme = async (req, res) => {
    try {
        const stories = await themeService.getStories(req.params.id);
        res.json(stories);
    } catch (error) {
        handleError(res, error);
    }
};

export const createTheme = async (req, res) => {
    try {
        if (!req.body.name) return res.status(400).json({ error: 'Missing name' });
        const theme = await themeService.create(req.body);
        res.status(201).json(theme);
    } catch (error) {
        handleError(res, error);
    }
};

export const updateTheme = async (req, res) => {
    try {
        if (!req.body.name) return res.status(400).json({ error: 'Missing name' });
        const theme = await themeService.update(req.params.id, req.body);
        res.json(theme);
    } catch (error) {
        handleError(res, error);
    }
};

export const deleteTheme = async (req, res) => {
    try {
        await themeService.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const mergeDuplicates = async (req, res) => {
    try {
        const result = await themeService.mergeDuplicates();
        res.json({ success: true, ...result });
    } catch (error) {
        handleError(res, error);
    }
};

export const updateStoriesTheme = async (req, res) => {
    try {
        const { themeId } = req.params;
        const { newThemeId } = req.body;
        if (!newThemeId) return res.status(400).json({ error: 'Missing newThemeId' });
        
        await themeService.updateStoriesTheme(themeId, newThemeId);
        res.json({ success: true, message: 'Stories updated successfully' });
    } catch (error) {
        handleError(res, error);
    }
};
