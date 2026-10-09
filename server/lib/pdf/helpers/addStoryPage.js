import { i18n } from '../../i18n.js';
import { drawStoryHeader } from '../themes.js';
import { drawImageInBox, loadImage } from './loadImage.js';
import { pdfSafe, storyParagraphs } from './storyText.js';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
/** Space kept at the bottom of text pages for the page number. */
const FOOTER_SPACE = 8;
/** A last page holding this many lines or fewer is avoided by tightening the spacing a little. */
const ORPHAN_LINES = 2;
const TIGHTEN_STEPS = [1, 0.95, 0.9];

/** "Jour 1 · Lundi" and the other metadata lines (week, age, tags). */
export const storyMetadata = (story) => {
  const dayOrder = Number(story.day_order ?? story.dayOrder);
  const dayKey = DAY_KEYS[dayOrder - 1];
  const week = story.week_number ?? story.weekNumber;
  const age = story.age_group ?? story.ageGroup;
  const lines = [];
  if (week) lines.push(i18n.t('pdf.week', { week }));
  if (age) lines.push(i18n.t('pdf.ageGroup', { age }));
  if (Array.isArray(story.themes) && story.themes.length > 0) {
    lines.push(i18n.t('pdf.tags', { tags: story.themes.map(theme => theme.name).join(', ') }));
  }
  return {
    label: dayKey ? pdfSafe(i18n.t('pdf.dayLabel', { number: dayOrder, day: i18n.t(`days.${dayKey}`) })) : '',
    lines: lines.map(pdfSafe).filter(Boolean)
  };
};

/** Lines of a paragraph, the first one shortened by the indent. */
const wrapParagraph = (doc, text, width, indent) => {
  if (!indent) return doc.splitTextToSize(text, width);
  const first = doc.splitTextToSize(text, width - indent)[0] || '';
  const rest = text.slice(text.indexOf(first) + first.length).trim();
  return [first, ...(rest ? doc.splitTextToSize(rest, width) : [])];
};

/**
 * Positions of every line of the text, without drawing.
 * @returns {{lines: {text: string, page: number, y: number, x: number, justify: boolean}[], pages: number, lastPageLines: number}}
 */
export const layoutText = (doc, paragraphs, layout, scale) => {
  const { width, top, firstTop, bottom, margin, sizes, theme } = layout;
  const lineHeight = sizes.lineHeight * scale;
  const paragraphSpacing = sizes.paragraphSpacing * scale;
  const result = [];
  let pageIndex = 0;
  let y = firstTop;

  for (const paragraph of paragraphs) {
    const wrapped = wrapParagraph(doc, paragraph, width, theme.indent);
    wrapped.forEach((text, index) => {
      if (y + lineHeight > bottom) {
        pageIndex++;
        y = top;
      }
      const isLast = index === wrapped.length - 1;
      result.push({ text, page: pageIndex, y, x: margin + (index === 0 ? theme.indent : 0), justify: theme.justify && !isLast });
      y += lineHeight;
    });
    y += paragraphSpacing;
  }
  const lastPage = result.length ? result[result.length - 1].page : 0;
  return { lines: result, pages: lastPage + 1, lastPageLines: result.filter(line => line.page === lastPage).length };
};

/**
 * Layout of a story's text, avoiding a last page with 1 or 2 lines: the spacing is tightened a little
 * (10 % at most) when that removes the page.
 */
export const chooseLayout = (doc, paragraphs, layout) => {
  const normal = layoutText(doc, paragraphs, layout, 1);
  if (normal.pages === 1 || normal.lastPageLines > ORPHAN_LINES) return normal;
  for (const scale of TIGHTEN_STEPS.slice(1)) {
    const tighter = layoutText(doc, paragraphs, layout, scale);
    if (tighter.pages < normal.pages) return tighter;
  }
  return normal;
};

/**
 * Adds a story, in the theme of the export. The caller has already added the first page.
 * - With an illustration: a title page (header and main illustration), then the text.
 * - Without: the header on top of the first text page (no near-empty title page).
 * @param {import('jspdf').jsPDF} doc
 * @param {Object} story - title, content, week_number, day_order, age_group, themes, illustrations
 * @param {Object} options - includeIllustrations
 * @param {Object} ctx - { theme, family, sizes }
 */
export function addStoryPage(doc, story, options, ctx) {
  const { theme, family, sizes } = ctx;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = theme.margin;
  const width = pageWidth - 2 * margin;
  const top = margin + (theme.id === 'pro' ? 6 : 0);
  const bottom = pageHeight - margin - FOOTER_SPACE;

  let y = drawStoryHeader(doc, ctx, pdfSafe(story.title), storyMetadata(story), top + 4);

  const image = options.includeIllustrations && story.illustrations?.length > 0 ? loadImage(story.illustrations[0]) : null;
  if (image) {
    drawImageInBox(doc, image, { x: margin, y, width, height: bottom - y });
    doc.addPage();
    y = top;
  }

  doc.setFont(family, 'normal');
  doc.setFontSize(sizes.bodySize);
  const paragraphs = storyParagraphs(story.content);
  const layout = { width, top, firstTop: y, bottom, margin, sizes, theme };

  const chosen = chooseLayout(doc, paragraphs, layout);

  doc.setTextColor(...theme.colors.text);
  let currentPage = 0;
  for (const line of chosen.lines) {
    while (currentPage < line.page) {
      doc.addPage();
      currentPage++;
    }
    const baseline = line.y + sizes.bodySize * 0.3528;
    if (line.justify) doc.text(line.text, line.x, baseline, { align: 'justify', maxWidth: width - (line.x - margin) });
    else doc.text(line.text, line.x, baseline);
  }
}
