import express from 'express';
import PDFExportService from '../lib/pdf/index.js';
import { upload } from '../config/upload.config.js';

const router = express.Router();

// The existing frontend calls /api/export/pdf
// We will mount this router at /api/export
// So this route is /pdf
/**
 * POST /api/export/pdf
 * Generate a PDF export of selected stories.
 * @param {Object} req.body - Export options (can be multipart/form-data or JSON).
 * @returns {ArrayBuffer} The generated PDF file.
 */
router.post('/pdf', upload.single('file'), async (req, res) => {
    // Note: upload.single('file') was in original code. 
    // It might be unnecessary if only JSON is sent, but keeping it for compatibility if frontend sends FormData with empty file or something.
    await PDFExportService.exportPdf(req, res);
});

export default router;
