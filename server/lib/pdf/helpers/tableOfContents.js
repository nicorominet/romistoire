import { i18n } from '../../i18n.js';
import { pdfSafe } from './storyText.js';

/** Default margin (mm) used to size the table of contents before the theme is known. */
const MARGIN = 22;
const TITLE_Y = MARGIN + 10;
const FIRST_ENTRY_Y = TITLE_Y + 16;
const ENTRY_HEIGHT = 8;
const PAGE_NUMBER_WIDTH = 15;
const BOTTOM_SPACE = MARGIN + 10;

/** Number of entries that fit on one page of the table of contents. */
export const entriesPerTocPage = (pageHeight) => Math.max(1, Math.floor((pageHeight - BOTTOM_SPACE - FIRST_ENTRY_Y) / ENTRY_HEIGHT));

/** Pages needed for the table of contents of `entryCount` stories. */
export const tocPageCount = (entryCount, pageHeight) => Math.max(1, Math.ceil(entryCount / entriesPerTocPage(pageHeight)));

/** Cuts a title to one line of `width` mm, with an ellipsis. */
const fitOneLine = (doc, text, width) => {
  if (doc.getTextWidth(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
};

/**
 * Fills the table of contents on the pages reserved for it (they were added before the stories,
 * so the page numbers written here are final).
 * @param {import('jspdf').jsPDF} doc
 * @param {{title: string, page: number}[]} entries - Story titles and their first page
 * @param {number} firstTocPage - First reserved page
 * @param {Object} ctx - { theme, family }
 */
export function fillTableOfContents(doc, entries, firstTocPage, ctx) {
  const { theme, family } = ctx;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const perPage = entriesPerTocPage(pageHeight);
  const right = pageWidth - MARGIN;
  const titleWidth = right - MARGIN - PAGE_NUMBER_WIDTH;

  entries.forEach((entry, index) => {
    const pageIndex = Math.floor(index / perPage);
    const row = index % perPage;
    doc.setPage(firstTocPage + pageIndex);

    if (row === 0) {
      doc.setFont(family, 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...theme.colors.title);
      doc.text(pdfSafe(i18n.t('pdf.tocTitle')), pageWidth / 2, TITLE_Y, { align: 'center' });
      doc.setDrawColor(...theme.colors.accent);
      doc.setLineWidth(0.6);
      doc.line(pageWidth / 2 - 12, TITLE_Y + 4, pageWidth / 2 + 12, TITLE_Y + 4);
    }

    const y = FIRST_ENTRY_Y + row * ENTRY_HEIGHT;
    doc.setFont(family, 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...theme.colors.text);
    const title = fitOneLine(doc, pdfSafe(entry.title), titleWidth);
    const pageLabel = String(entry.page);
    doc.text(title, MARGIN, y);
    doc.setTextColor(...theme.colors.accent);
    doc.text(pageLabel, right, y, { align: 'right' });

    // Dot leader between the title and the page number
    const dotsStart = MARGIN + doc.getTextWidth(title) + 2;
    const dotsEnd = right - doc.getTextWidth(pageLabel) - 2;
    const dot = doc.getTextWidth('.');
    if (dotsEnd > dotsStart && dot > 0) {
      doc.setTextColor(170, 170, 170);
      doc.text('.'.repeat(Math.floor((dotsEnd - dotsStart) / dot)), dotsStart, y);
    }
  });
}
