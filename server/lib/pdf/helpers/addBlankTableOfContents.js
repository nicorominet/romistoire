import { i18n } from '../../i18n.js';

/**
 * Adds a blank table of contents page to the PDF document.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance
 */
export function addBlankTableOfContents(doc) {
  const { t } = i18n;
  const pageWidth = doc.internal.pageSize.width;

  // Add a new page BEFORE writing the table of contents
  doc.addPage();

  doc.setFontSize(18);
  doc.setTextColor(70, 50, 140);

  const title = t('pdf.tocTitle'); // Use i18n.t()
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, 20);
}
