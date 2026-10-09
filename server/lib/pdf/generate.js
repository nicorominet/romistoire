import { jsPDF } from 'jspdf';
import { i18n, init } from '../i18n.js';
import { registerThemeFonts } from './fontRegistry.js';
import { decoratePage, resolveTheme, themeSizes } from './themes.js';
import { addCoverPage } from './helpers/addCoverPage.js';
import { addStoryPage } from './helpers/addStoryPage.js';
import { addIllustrations } from './helpers/addIllustrations.js';
import { fillTableOfContents, tocPageCount } from './helpers/tableOfContents.js';
import { storyService } from '../../services/story.service.js';

const AGE_ORDER = ['2-3', '4-6', '7-9', '10-12', '13-15', '16-18'];

/** Book order: week, then age group, then day, then title. */
export const sortStoriesForBook = (stories) => [...stories].sort((a, b) =>
  (Number(a.week_number) || 0) - (Number(b.week_number) || 0)
  || AGE_ORDER.indexOf(a.age_group) - AGE_ORDER.indexOf(b.age_group)
  || (Number(a.day_order) || 0) - (Number(b.day_order) || 0)
  || String(a.title).localeCompare(String(b.title)));

/**
 * Builds the PDF of the selected stories, in a style: kids, teen or pro (or auto, from the youngest age group).
 * Layout: optional cover, optional table of contents (pages reserved up front so its page numbers are right),
 * then each story (header, main illustration if any, text, other illustrations). Frames, running headers and
 * page numbers are drawn last, once every page exists.
 * @param {Object} options - { stories: ids, style, coverPage, tableOfContents, includeIllustrations, fontSize,
 *   pageSize, orientation, coverTitle, coverSubtitle }
 * @returns {Promise<import('jspdf').jsPDF>}
 */
async function generatePDF(options) {
  if (!i18n.isLoaded()) await init();
  if (!options?.stories?.length) throw new Error('No stories provided for PDF generation');

  const stories = sortStoriesForBook((await storyService.findByIds(options.stories)).filter(Boolean));
  if (stories.length === 0) throw new Error('No stories found for the provided IDs');

  const doc = new jsPDF({
    orientation: options.orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: String(options.pageSize || 'a4').toLowerCase()
  });

  const theme = resolveTheme(options, stories);
  const family = registerThemeFonts(doc, theme);
  const ctx = { theme, family, sizes: themeSizes(theme, options.fontSize) };
  doc.setFont(family, 'normal');

  // What each page holds, for the frames, running headers and page numbers drawn at the end
  const pages = [];
  const markPages = (info) => {
    while (pages.length < doc.getNumberOfPages()) pages.push(info);
  };

  // Page 1 exists already: it holds the cover, the first contents page or the first story
  let pageInUse = false;
  const nextPage = () => {
    if (pageInUse) doc.addPage();
    pageInUse = true;
  };

  if (options.coverPage) {
    nextPage();
    addCoverPage(doc, stories, options, ctx);
    markPages({ type: 'cover' });
  }

  let firstTocPage = null;
  if (options.tableOfContents) {
    const tocPages = tocPageCount(stories.length, doc.internal.pageSize.getHeight());
    for (let i = 0; i < tocPages; i++) {
      nextPage();
      if (i === 0) firstTocPage = doc.getNumberOfPages();
    }
    markPages({ type: 'toc' });
  }

  const entries = [];
  for (const story of stories) {
    nextPage();
    entries.push({ title: story.title, page: doc.getNumberOfPages() });
    addStoryPage(doc, story, options, ctx);
    markPages({ type: 'story', storyTitle: story.title });
    await addIllustrations(doc, story, options, ctx);
    markPages({ type: 'illustration', storyTitle: story.title });
  }

  if (firstTocPage) fillTableOfContents(doc, entries, firstTocPage, ctx);

  const total = doc.getNumberOfPages();
  pages.forEach((info, index) => {
    doc.setPage(index + 1);
    decoratePage(doc, ctx, info, index + 1, total);
  });
  return doc;
}

export { generatePDF };
