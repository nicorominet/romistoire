import express from 'express';
import * as systemController from '../controllers/system.controller.js';
import multer from 'multer';
import { upload, dataUpload, InvalidFileTypeError } from '../config/upload.config.js';

const router = express.Router();

/**
 * Runs multer's single-image upload and turns its errors (size, type) into a readable 400.
 */
const uploadSingleImage = (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Image too large (5 MB maximum).' });
        }
        if (err instanceof multer.MulterError || err instanceof InvalidFileTypeError) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    });
};

/**
 * POST /api/import-data
 * Import database data from a JSON file.
 * @param {Object} req.file - The uploaded JSON file.
 * @returns {Object} Success status.
 */
router.post('/import-data', dataUpload.single('file'), systemController.importData);

/**
 * GET /api/export-data
 * Export all stories and themes to JSON.
 * @returns {Object} JSON object containing exported data.
 */
router.get('/export-data', systemController.exportData);

/**
 * GET /api/export-full
 * Export entire database content to JSON.
 * @returns {Object} JSON object containing full database dump.
 */
router.get('/export-full', systemController.exportFull);

/**
 * DELETE /api/cleanup-images
 * Delete unused images from the uploads directory.
 * @returns {Object} Cleanup statistics.
 */
router.delete('/cleanup-images', systemController.cleanupImages);

/**
 * DELETE /api/reset-data
 * Reset the database to initial state.
 * @returns {Object} Success status.
 */
router.delete('/reset-data', systemController.resetData);

/**
 * POST /api/upload
 * Upload a single image file.
 * @param {Object} req.file - The uploaded image file.
 * @returns {Object} Upload result with file path.
 */
router.post('/upload', uploadSingleImage, systemController.uploadImage);

/**
 * GET /api/config/logs
 * Get current log configuration.
 */
router.get('/config/logs', systemController.getLogConfig);

/**
 * PUT /api/config/logs
 * Update log configuration.
 */
router.put('/config/logs', systemController.updateLogConfig);

export default router;
