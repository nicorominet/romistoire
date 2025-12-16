import { systemService } from '../services/system.service.js';
import { handleError } from '../middleware/error.middleware.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { ENV_CONFIG } from '../config/env.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export const getLogs = async (req, res) => {
    try {
        const logs = await systemService.getLogsList();
        res.json(logs);
    } catch (error) {
        handleError(res, error);
    }
};

export const getLogDetails = async (req, res) => {
    try {
        const logs = await systemService.getLogContent(req.params.filename);
        res.json(logs);
    } catch (error) {
        handleError(res, error);
    }
};

export const serveImage = async (req, res) => {
  try {
    const { yearMonth, filename } = req.params;
    // Security check
    const safeYearMonth = yearMonth.replace(/[^0-9-]/g, '');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    
    const imagePath = path.join(ENV_CONFIG.UPLOADS_DIR, safeYearMonth, safeFilename);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    }[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    fs.createReadStream(imagePath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to serve image' });
  }
};
