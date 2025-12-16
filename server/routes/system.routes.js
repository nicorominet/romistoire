import express from 'express';
import * as systemController from '../controllers/system.controller.js';
import { upload, dataUpload } from '../config/upload.config.js';

const router = express.Router();

router.post('/import-data', dataUpload.single('file'), systemController.importData);
router.get('/export-data', systemController.exportData);
router.get('/export-full', systemController.exportFull);
router.delete('/cleanup-images', systemController.cleanupImages);
router.delete('/reset-data', systemController.resetData);
router.post('/upload', upload.single('image'), systemController.uploadImage);

router.get('/logs', systemController.getLogs);
router.get('/logs/:filename', systemController.getLogDetails);

router.get('/images/:yearMonth/:filename', systemController.serveImage);

export default router;
