import { storyService } from '../services/story.service.js';
import { handleError } from '../middleware/error.middleware.js';

export const getStories = async (req, res) => {
  try {
    const stories = await storyService.findAll(req.query);
    res.json(stories);
  } catch (error) {
    handleError(res, error);
  }
};

export const getAvailableWeeks = async (req, res) => {
    try {
        const weeks = await storyService.getAvailableWeeks(req.query);
        res.json(weeks);
    } catch (error) {
        handleError(res, error);
    }
};

export const getStoryById = async (req, res) => {
  try {
    const story = await storyService.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  } catch (error) {
    handleError(res, error);
  }
};

export const getStoryIllustrations = async (req, res) => {
    try {
        const illustrations = await storyService.getIllustrations(req.params.id);
        res.json(illustrations);
    } catch (error) {
        handleError(res, error);
    }
};

export const getNextStory = async (req, res) => {
    try {
        const story = await storyService.getNext(req.params.id);
        res.json(story || null);
    } catch (error) {
        handleError(res, error);
    }
};

export const getPreviousStory = async (req, res) => {
    try {
        const story = await storyService.getPrevious(req.params.id);
        res.json(story || null);
    } catch (error) {
        handleError(res, error);
    }
};

export const getStoryNeighbors = async (req, res) => {
    try {
        const neighbors = await storyService.getNeighbors(req.params.id);
        res.json(neighbors);
    } catch (error) {
        handleError(res, error);
    }
};


export const createStory = async (req, res) => {
  try {
    const story = await storyService.create(req.body);
    res.status(201).json(story);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateStory = async (req, res) => {
    try {
        const story = await storyService.update(req.params.id, req.body);
        res.json(story);
    } catch (error) {
        handleError(res, error);
    }
};

export const deleteStory = async (req, res) => {
  try {
    await storyService.delete(req.params.id);
    res.json({ success: true, message: 'Story deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

export const getStoryVersions = async (req, res) => {
  try {
    const versions = await storyService.getVersions(req.params.id);
    res.json(versions);
  } catch (error) {
     handleError(res, error);
  }
};

export const restoreStoryVersion = async (req, res) => {
  try {
    await storyService.restoreVersion(req.params.id, req.params.versionId);
    res.json({ success: true, message: 'Version restored successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

export const generateAIStory = async (req, res) => {
  try {
    const result = await storyService.generateFromAI(req.body, req.body.aiProvider);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteIllustration = async (req, res) => {
    try {
        const { id, illustrationId } = req.params;
        await storyService.deleteIllustration(id, illustrationId);
        res.json({ success: true, message: 'Illustration deleted' });
    } catch (error) {
        handleError(res, error);
    }
};

export const generateAudio = async (req, res) => {
    try {
        const audioPath = await storyService.generateAudioForStory(req.params.id);
        res.json({ success: true, audioPath });
    } catch (error) {
        if (error.message === 'Story not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Story content is empty') return res.status(400).json({ error: error.message });
        handleError(res, error);
    }
};
