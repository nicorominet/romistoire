import { i18n } from '../../i18n.js';
import { drawCover } from '../themes.js';
import { pdfSafe } from './storyText.js';

/**
 * Adds the cover page, in the theme of the export: title and subtitle, number of stories, generation date.
 * @param {import('jspdf').jsPDF} doc
 * @param {Array} stories
 * @param {Object} options - coverTitle, coverSubtitle
 * @param {Object} ctx - { theme, family }
 */
export function addCoverPage(doc, stories, options, ctx) {
  const { t } = i18n;
  const date = new Date().toLocaleDateString(i18n.getCurrentLocale() === 'en' ? 'en-GB' : 'fr-FR');
  drawCover(doc, ctx, {
    title: pdfSafe(options.coverTitle || t('pdf.defaultCoverTitle')),
    subtitle: options.coverSubtitle ? pdfSafe(options.coverSubtitle) : '',
    count: pdfSafe(t('pdf.storiesCount', { count: stories.length })),
    date: pdfSafe(t('pdf.generatedOn', { date }))
  });
}
