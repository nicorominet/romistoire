import { i18n } from '../../i18n.js';

/**
 * Adds a cover page to the PDF document.
 * @param {import('jspdf').jsPDF} doc - The jsPDF document instance
 * @param {Array} stories - The array of stories to be included in the PDF
 * @param {Object} options - The export options
 */
export function addCoverPage(doc, stories, options) {
  const { t } = i18n;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  console.log('i18n isLoaded:', i18n.isLoaded());  // Add this line for debugging
  console.log('Current locale:', i18n.getCurrentLocale()); // Add this line for debugging

  // Title
  doc.setFontSize(24);
  doc.setTextColor(70, 50, 140);
  const title = options.coverTitle || t('pdf.defaultCoverTitle'); // Use i18n.t()
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, 40);
    console.log("Title:", title)

  // Subtitle (if provided)
  if (options.coverSubtitle) {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    const subtitle = options.coverSubtitle;
    const subtitleWidth = doc.getTextWidth(subtitle);
    doc.text(subtitle, (pageWidth - subtitleWidth) / 2, 60);
  }

  // Stories count
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  const storiesText = `${stories.length} ${t('pdf.stories')}`;  // Use i18n.t()
  const storiesWidth = doc.getTextWidth(storiesText);
  doc.text(storiesText, (pageWidth - storiesWidth) / 2, 80);
    console.log("Stories Text", storiesText)

  // Date de génération
  const dateText = `${t('pdf.generatedOn')} ${new Date().toLocaleDateString()}`; // Use i18n.t()
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, (pageWidth - dateWidth) / 2, pageHeight - margin);
    console.log("Date Text", dateText)
}
