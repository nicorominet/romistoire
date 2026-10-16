import express from 'express';
import PDFExportService from '../lib/pdf/index.js';

const router = express.Router();

/**
 * POST /api/export/pdf
 * Generate a PDF export of selected stories.
 * @param {Object} req.body - Export options (JSON): stories, style, includeIllustrations...
 * @returns {ArrayBuffer} The generated PDF file.
 */
router.post('/pdf', async (req, res) => {
    await PDFExportService.exportPdf(req, res);
});

export default router;
