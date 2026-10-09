import { i18n } from '../../i18n.js';
import { drawImageInBox, loadImage } from './loadImage.js';
import { pdfSafe } from './storyText.js';

const CAPTION_SPACE = 15;

/**
 * Adds the other illustrations of a story (the first one is on its title page), one per page, with a caption.
 * @param {import('jspdf').jsPDF} doc
 * @param {Object} story
 * @param {Object} options - includeIllustrations
 * @param {Object} ctx - { theme, family }
 */
export async function addIllustrations(doc, story, options, ctx) {
  if (!options.includeIllustrations || !(story.illustrations?.length > 1)) return;
  const { theme, family } = ctx;

  for (const illustration of story.illustrations.slice(1)) {
    const image = loadImage(illustration);
    if (!image) continue;

    doc.addPage();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const width = pageWidth - 2 * theme.margin;
    const height = pageHeight - 2 * theme.margin - CAPTION_SPACE;
    const drawn = drawImageInBox(doc, image, { x: theme.margin, y: theme.margin, width, height });
    if (!drawn) continue;

    doc.setFont(family, 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...theme.colors.muted);
    const caption = doc.splitTextToSize(pdfSafe(i18n.t('pdf.illustrationFor', { title: story.title })), width);
    doc.text(caption, pageWidth / 2, theme.margin + drawn + 8, { align: 'center' });
  }
}
