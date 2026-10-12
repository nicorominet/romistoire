import { illustrationService } from '../services/illustration.service.js';
import { handleError } from '../middleware/error.middleware.js';

/** Same filters as the story list (story_query.helper.js); without image by default. */
const FILTER_KEYS = ['locale', 'weekNumber', 'ageGroup', 'theme', 'dayOfWeek', 'search', 'hasAudio', 'seriesId', 'source', 'editStatus', 'reviewStatus', 'generationJobId'];
const filtersOf = (req) => ({
  ...Object.fromEntries(FILTER_KEYS.filter(key => req.query[key]).map(key => [key, String(req.query[key])])),
  hasImage: ['all', 'yes'].includes(req.query.hasImage) ? req.query.hasImage : 'no'
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
