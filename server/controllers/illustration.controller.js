import { illustrationService } from '../services/illustration.service.js';
import { handleError } from '../middleware/error.middleware.js';

const filtersOf = (req) => ({
  locale: req.query.locale,
  weekNumber: req.query.weekNumber,
  ageGroup: req.query.ageGroup,
  hasImage: req.query.hasImage === 'all' ? 'all' : 'no'
});

export const getTodo = async (req, res) => {
  try {
    res.json(await illustrationService.findTodo(filtersOf(req)));
  } catch (error) {
    handleError(res, error);
  }
};

export const exportPrompts = async (req, res) => {
  try {
    const { body, filename, type } = await illustrationService.exportPrompts(filtersOf(req), req.query.format === 'json' ? 'json' : 'txt');
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (error) {
    handleError(res, error);
  }
};

export const generatePrompt = async (req, res) => {
  try {
    res.json(await illustrationService.generatePrompt(req.params.storyId));
  } catch (error) {
    handleError(res, error);
  }
};

export const setPrompt = async (req, res) => {
  try {
    res.json(await illustrationService.setPrompt(req.params.storyId, req.body?.prompt));
  } catch (error) {
    handleError(res, error);
  }
};
