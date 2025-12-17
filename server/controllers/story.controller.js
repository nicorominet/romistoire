import { storyService } from '../services/story.service.js';
import { geminiService } from '../services/gemini.service.js';
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
    const result = await geminiService.generateStory(req.body);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteIllustration = async (req, res) => {
    try {
        const { id, illustrationId } = req.params;
        const imagePath = await storyService.deleteIllustration(id, illustrationId);
        
        if (imagePath) {
             // Optional: delete file immediately
        }
        
        res.json({ success: true, message: 'Illustration deleted' });
    } catch (error) {
        handleError(res, error);
    }
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateAudio = async (req, res) => {
    try {
        const { id } = req.params;
        const story = await storyService.findById(id);
        
        if (!story) {
            return res.status(404).json({ error: 'Story not found' });
        }

        if (!story.content) {
             return res.status(400).json({ error: 'Story content is empty' });
        }

        console.log(`Generating audio for story ${id}...`);
        const { audioBuffer, mimeType } = await geminiService.generateAudio(story.content);
        
        // Save to public/audio
        const audioDir = path.join(__dirname, '../../public/audio');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }

        const extension = 'wav';
        console.log(`Received audio, saving as .${extension}`);

        const fileName = `${id}_v${story.version || 1}.${extension}`;
        const filePath = path.join(audioDir, fileName);
        
        fs.writeFileSync(filePath, audioBuffer);
        
        const publicUrl = `/audio/${fileName}`;
        
        // Update story
        await storyService.saveAudioPath(id, publicUrl);
        
        res.json({ success: true, audioPath: publicUrl });
    } catch (error) {
        handleError(res, error);
    }
};
