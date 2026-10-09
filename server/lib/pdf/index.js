import { generatePDF } from './generate.js';
import { getDefaultFilename } from './helpers/getDefaultFilename.js';

const PDFExportService = {
  /**
   * Builds the PDF and returns it as a file buffer.
   * @param {Object} options - Export options (see generatePDF)
   * @returns {Promise<{buffer: Buffer, filename: string}>}
   */
  async generatePdf(options) {
    const doc = await generatePDF(options);
    return { buffer: Buffer.from(doc.output('arraybuffer')), filename: getDefaultFilename() };
  },

  /**
   * POST /api/export/pdf: sends the PDF file itself (application/pdf), downloaded by the client.
   */
  async exportPdf(req, res) {
    try {
      if (!req.body || !Array.isArray(req.body.stories) || req.body.stories.length === 0) {
        return res.status(400).json({ error: 'Invalid export options: No stories provided' });
      }

      const { buffer, filename } = await this.generatePdf(req.body);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error('Error in PDF export:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
};

export default PDFExportService;
