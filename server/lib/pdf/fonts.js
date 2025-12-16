/**
 * Configures fonts for the PDF document based on export options.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance
 * @param {Object} options - The export options
 */
export function configureFonts(doc, options) {
  // Default font configuration
  doc.setFont('helvetica');

  // Configure font style based on options
  switch (options.fontFamily) {
    case 'serif':
      doc.setFont('times');
      break;
    case 'sans':
      doc.setFont('helvetica');
      break;
    case 'mono':
      doc.setFont('courier');
      break;
    default:
      doc.setFont('helvetica');
  }

  // Configure font size
  let baseFontSize = 12;
  switch (options.fontSize) {
    case 'small':
      baseFontSize = 10;
      break;
    case 'large':
      baseFontSize = 14;
      break;
  }
  doc.setFontSize(baseFontSize);
}
