import { weeklyThemeService } from '../services/weeklyTheme.service.js';
import { handleError } from '../middleware/error.middleware.js';

export const getWeeklyThemes = async (req, res) => {
    try {
        const themes = await weeklyThemeService.findAll();
        res.json(themes);
    } catch (error) {
        handleError(res, error);
    }
};

export const updateWeeklyThemes = async (req, res) => {
    try {
        await weeklyThemeService.update(req.body);
        res.json({ success: true });
    } catch (error) {
        handleError(res, error);
    }
};

/** AI topic suggestions for weeks of the program: { weeks }. */
export const suggestWeekThemes = async (req, res) => {
    try {
        res.json(await weeklyThemeService.suggest(req.body?.weeks));
    } catch (error) {
        handleError(res, error);
    }
};

export const setWeekTheme = async (req, res) => {
    try {
        const week = await weeklyThemeService.setWeek(req.params.week, req.body || {});
        res.json(week);
    } catch (error) {
        handleError(res, error);
    }
};

export const clearWeekTheme = async (req, res) => {
    try {
        await weeklyThemeService.clearWeek(req.params.week);
        res.json({ success: true });
    } catch (error) {
        handleError(res, error);
    }
};
