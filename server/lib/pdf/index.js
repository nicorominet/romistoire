import { generatePDF } from './generate.js';
import { savePDF } from './save.js';

const PDFExportService = {
  async generatePdf(options) {
    try {
      const doc = await generatePDF(options);
      const pdfUrl = savePDF(doc);
      return { url: pdfUrl };
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  },

  async exportPdf(req, res) {
    try {
      if (!req.body || !req.body.stories || req.body.stories.length === 0) {
        return res.status(400).json({ error: 'Invalid export options: No stories provided' });
      }

      const result = await this.generatePdf(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error in PDF export:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
};

export default PDFExportService;
