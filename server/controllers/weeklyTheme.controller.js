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
