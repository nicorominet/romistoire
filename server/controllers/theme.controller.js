import { themeService } from '../services/theme.service.js';
import { handleError } from '../middleware/error.middleware.js';

const isTrue = (value) => value === true || value === 'true' || value === '1';

export const getThemes = async (req, res) => {
    try {
        const themes = await themeService.findAll({
            search: req.query.search,
            sort: req.query.sort,
            needsReview: isTrue(req.query.needsReview),
            unused: isTrue(req.query.unused)
        });
        res.json(themes);
    } catch (error) {
        handleError(res, error);
    }
};

export const getDuplicateThemes = async (req, res) => {
    try {
        res.json(await themeService.findDuplicateGroups());
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

/** 201 for a new theme, 200 when a theme with the same name already existed. */
export const createTheme = async (req, res) => {
    try {
        const { theme, existing } = await themeService.create(req.body || {});
        res.status(existing ? 200 : 201).json({ ...theme, existing });
    } catch (error) {
        handleError(res, error);
    }
};

export const updateTheme = async (req, res) => {
    try {
        const theme = await themeService.update(req.params.id, req.body || {});
        res.json(theme);
    } catch (error) {
        handleError(res, error);
    }
};

export const deleteTheme = async (req, res) => {
    try {
        const result = await themeService.delete(req.params.id, { reassignTo: req.query.reassignTo || null });
        res.json({ success: true, ...result });
    } catch (error) {
        handleError(res, error);
    }
};

export const mergeThemes = async (req, res) => {
    try {
        const { sourceIds, targetId } = req.body || {};
        const result = await themeService.mergeThemes(sourceIds, targetId);
        res.json({ success: true, ...result });
    } catch (error) {
        handleError(res, error);
    }
};
