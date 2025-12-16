import { getDefaultFilename } from './helpers/getDefaultFilename.js';

/**
 * Saves the PDF document and returns a data URI.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance
 * @param {string} [filename] - Optional filename for the saved PDF
 * @returns {string} The data URI string of the saved PDF
 */
export function savePDF(doc, filename) {
  const finalFilename = filename || getDefaultFilename();
  doc.save(finalFilename);
  return doc.output('datauristring');
}
