import { i18n } from '../../i18n.js';
import { pdfSafe } from './storyText.js';

/** Default margin (mm) used to size the table of contents before the theme is known. */
const MARGIN = 22;
const TITLE_Y = MARGIN + 10;
const FIRST_ENTRY_Y = TITLE_Y + 16;
const ENTRY_HEIGHT = 11;
const PAGE_NUMBER_WIDTH = 18;
const INDEX_WIDTH = 16;
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
  const titleX = MARGIN + INDEX_WIDTH;
  const pageBadgeX = right - PAGE_NUMBER_WIDTH;
  const titleWidth = pageBadgeX - titleX - 4;

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
      doc.setLineWidth(0.8);
      doc.line(pageWidth / 2 - 18, TITLE_Y + 5, pageWidth / 2 + 18, TITLE_Y + 5);
      doc.setFillColor(...theme.colors.accent);
      doc.circle(pageWidth / 2, TITLE_Y + 5, 1.4, 'F');
    }

    const y = FIRST_ENTRY_Y + row * ENTRY_HEIGHT;
    const rowTop = y - 5.5;
    const chapterNumber = String(index + 1).padStart(2, '0');
    const pageLabel = String(entry.page);

    if (theme.id === 'kids') {
      doc.setFillColor(...theme.colors.soft);
      doc.roundedRect(MARGIN, rowTop, right - MARGIN, 9, 4, 4, 'F');
      doc.setFillColor(...theme.colors.accent);
      doc.circle(MARGIN + 5, y - 1, 3.2, 'F');
      doc.setFont(family, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(chapterNumber, MARGIN + 5, y + 1.2, { align: 'center' });
    } else if (theme.id === 'teen') {
      doc.setFillColor(...theme.colors.accent);
      doc.roundedRect(MARGIN, rowTop, 2, 9, 1, 1, 'F');
      doc.setFont(family, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...theme.colors.accent);
      doc.text(chapterNumber, MARGIN + 5, y + 1);
    } else {
      doc.setFont(family, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...theme.colors.accent);
      doc.text(chapterNumber, MARGIN + 2, y + 1);
    }

    doc.setFont(family, 'normal');
    doc.setFontSize(theme.id === 'kids' ? 11 : 12);
    doc.setTextColor(...theme.colors.text);
    const title = fitOneLine(doc, pdfSafe(entry.title), titleWidth);
    doc.text(title, titleX, y);

    if (theme.id === 'pro') {
      doc.setDrawColor(...theme.colors.border);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 3, right, y + 3);
      doc.setFont(family, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...theme.colors.accent);
      doc.text(pageLabel, right, y, { align: 'right' });
    } else {
      const badgeRadius = 3.4;
      doc.setFillColor(...theme.colors.title);
      doc.circle(right - badgeRadius, y - 1, badgeRadius, 'F');
      doc.setFont(family, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(pageLabel, right - badgeRadius, y + 1, { align: 'center' });
    }

    // Dot leader between the title and the page number
    const dotsStart = titleX + doc.getTextWidth(title) + 2;
    const dotsEnd = pageBadgeX - 2;
    doc.setFont(family, 'normal');
    doc.setFontSize(8);
    const dot = doc.getTextWidth('.');
    if (dotsEnd > dotsStart && dot > 0) {
      doc.setTextColor(170, 170, 170);
      doc.text('.'.repeat(Math.floor((dotsEnd - dotsStart) / dot)), dotsStart, y);
    }
  });
}
