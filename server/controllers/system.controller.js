import { systemService } from '../services/system.service.js';
import { handleError } from '../middleware/error.middleware.js';

export const importData = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided.' });
        const result = await systemService.importData(req.file, req.body.mode);
        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
};

export const exportData = async (req, res) => {
  try {
    const result = await systemService.exportData(false);
    res.setHeader('Content-Type', result.type);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error) {
    handleError(res, error);
  }
};

export const exportFull = async (req, res) => {
  try {
    const result = await systemService.exportData(true);
    res.setHeader('Content-Type', result.type);
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.buffer);
  } catch (error) {
    handleError(res, error);
  }
};

export const cleanupImages = async (req, res) => {
  try {
    const result = await systemService.cleanupImages();
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const resetData = async (req, res) => {
    try {
        await systemService.resetData();
        res.json({ success: true, message: 'Data reset successfully' });
    } catch (error) {
        handleError(res, error);
    }
};

export const uploadImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image provided' });
        const result = await systemService.uploadImage(req.file, req.body);
        res.json(result);
    } catch (error) {
        handleError(res, error);
    }
};

export const getLogConfig = async (req, res) => {
    try {
        const config = systemService.getLogConfig();
        res.json(config);
    } catch (error) {
        handleError(res, error);
    }
};

export const updateLogConfig = async (req, res) => {
    try {
        const config = systemService.updateLogConfig(req.body);
        res.json(config);
    } catch (error) {
        handleError(res, error);
    }
};
