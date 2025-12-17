import express from 'express';
import * as systemController from '../controllers/system.controller.js';
import { upload, dataUpload } from '../config/upload.config.js';

const router = express.Router();

/**
 * POST /api/system/import-data
 * Import database data from a JSON file.
 * @param {Object} req.file - The uploaded JSON file.
 * @returns {Object} Success status.
 */
router.post('/import-data', dataUpload.single('file'), systemController.importData);

/**
 * GET /api/system/export-data
 * Export all stories and themes to JSON.
 * @returns {Object} JSON object containing exported data.
 */
router.get('/export-data', systemController.exportData);

/**
 * GET /api/system/export-full
 * Export entire database content to JSON.
 * @returns {Object} JSON object containing full database dump.
 */
router.get('/export-full', systemController.exportFull);

/**
 * DELETE /api/system/cleanup-images
 * Delete unused images from the uploads directory.
 * @returns {Object} Cleanup statistics.
 */
router.delete('/cleanup-images', systemController.cleanupImages);

/**
 * DELETE /api/system/reset-data
 * Reset the database to initial state.
 * @returns {Object} Success status.
 */
router.delete('/reset-data', systemController.resetData);

/**
 * POST /api/system/upload
 * Upload a single image file.
 * @param {Object} req.file - The uploaded image file.
 * @returns {Object} Upload result with file path.
 */
router.post('/upload', upload.single('image'), systemController.uploadImage);

/**
 * GET /api/system/logs
 * Retrieve system logs.
 * @returns {Array} List of logs.
 */
router.get('/logs', systemController.getLogs);

/**
 * GET /api/system/logs/:filename
 * Retrieve details/content of a specific log file.
 * @param {string} req.params.filename - Log filename.
 * @returns {Object} Log content.
 */
router.get('/logs/:filename', systemController.getLogDetails);

/**
 * GET /api/system/images/:yearMonth/:filename
 * Serve a specific image file (proxy/helper).
 * @param {string} req.params.yearMonth - Year/Month folder.
 * @param {string} req.params.filename - Image filename.
 * @returns {File} The image file.
 */
router.get('/images/:yearMonth/:filename', systemController.serveImage);

export default router;
