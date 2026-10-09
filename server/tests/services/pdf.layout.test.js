// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsPDF } from 'jspdf';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/story.service.js', () => ({ storyService: { findByIds: vi.fn() } }));

const { storyParagraphs, pdfSafe } = await import('../../lib/pdf/helpers/storyText.js');
const { THEMES, resolveTheme, themeSizes } = await import('../../lib/pdf/themes.js');
const { registerThemeFonts } = await import('../../lib/pdf/fontRegistry.js');
const { tocPageCount, entriesPerTocPage } = await import('../../lib/pdf/helpers/tableOfContents.js');
const { sortStoriesForBook, generatePDF } = await import('../../lib/pdf/generate.js');
const { i18n, init } = await import('../../lib/i18n.js');
const { storyService } = await import('../../services/story.service.js');
const { default: PDFExportService } = await import('../../lib/pdf/index.js');

describe('PDF story text', () => {
  it('should turn editor HTML into paragraphs (generated stories)', () => {
    expect(storyParagraphs("<p>Au bord de l'eau, Marouin s&#39;agenouilla.</p><p>Il riait &amp; chantait.</p>"))
      .toEqual(["Au bord de l'eau, Marouin s'agenouilla.", 'Il riait & chantait.']);
  });

  it('should keep older plain-text stories readable', () => {
    expect(storyParagraphs('**Il était une fois** Léa.\n\nFin.\n[Illustration: une forêt]')).toEqual(['Il était une fois Léa.', 'Fin.']);
  });

  it('should only keep characters of the standard PDF fonts, with French typography', () => {
    expect(pdfSafe('en riant 🌊.')).toBe('en riant.');
    expect(pdfSafe('« Attends-moi ! »')).toBe('« Attends-moi ! »');
    expect(pdfSafe('é è à ù ç œ')).toBe('é è à ù ç œ');
  });
});

describe('PDF layout', () => {
  it('should choose the style: forced, or from the youngest age group in auto', () => {
    expect(resolveTheme({ style: 'auto' }, [{ age_group: '4-6' }]).id).toBe('kids');
    expect(resolveTheme({}, [{ age_group: '13-15' }, { age_group: '4-6' }]).id).toBe('kids');
    expect(resolveTheme({ style: 'auto' }, [{ age_group: '10-12' }]).id).toBe('teen');
    expect(resolveTheme({ style: 'pro' }, [{ age_group: '4-6' }]).id).toBe('pro');
  });

  it('should size the text of each style from the size option', () => {
    expect(themeSizes(THEMES.kids, 'medium').bodySize).toBe(18);
    expect(themeSizes(THEMES.teen, 'large').bodySize).toBe(14);
    expect(themeSizes(THEMES.pro, 'small').bodySize).toBe(11);
    expect(themeSizes(THEMES.pro, 'unknown').bodySize).toBe(12);
  });

  it('should fall back to a standard font when the font files are missing', () => {
    const doc = new jsPDF();
    expect(registerThemeFonts(doc, THEMES.pro, '/nowhere')).toBe('times');
    expect(registerThemeFonts(doc, THEMES.kids)).toBe('Andika');
  });

  it('should reserve enough table of contents pages', () => {
    const perPage = entriesPerTocPage(297);
    expect(tocPageCount(perPage, 297)).toBe(1);
    expect(tocPageCount(perPage + 1, 297)).toBe(2);
  });

  it('should order the book by week, age group, then day', () => {
    const sorted = sortStoriesForBook([
      { title: 'C', week_number: 30, age_group: '4-6', day_order: 2 },
      { title: 'A', week_number: 12, age_group: '7-9', day_order: 1 },
      { title: 'D', week_number: 30, age_group: '10-12', day_order: 1 },
      { title: 'B', week_number: 30, age_group: '4-6', day_order: 1 }
    ]);
    expect(sorted.map(story => story.title)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('PDF generation', () => {
  beforeEach(() => vi.clearAllMocks());

  const story = (id, week, day) => ({
    id, title: `Histoire ${id}`, week_number: week, day_order: day, age_group: '4-6', themes: [{ name: 'Nature' }],
    content: '<p>Premier paragraphe.</p><p>Second paragraphe.</p>', illustrations: []
  });

  it('should build a book with cover and contents, without near-empty title pages', async () => {
    storyService.findByIds.mockResolvedValue([story('b', 30, 2), story('a', 30, 1)]);

    const doc = await generatePDF({ stories: ['b', 'a'], coverPage: true, tableOfContents: true, style: 'teen' });

    // cover + contents + 2 short stories without illustration, each on a single page
    expect(doc.getNumberOfPages()).toBe(4);
  });

  it.each([['kids', 'Andika'], ['teen', 'Poppins'], ['pro', 'CrimsonText']])('should embed the font of the %s style', async (style, font) => {
    storyService.findByIds.mockResolvedValue([story('a', 30, 1)]);

    const doc = await generatePDF({ stories: ['a'], style, coverPage: true });

    const pdf = Buffer.from(doc.output('arraybuffer')).toString('latin1');
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf).toContain(`/BaseFont /${font}`);
  });

  it('should avoid a last page with one or two lines', async () => {
    const { layoutText, chooseLayout } = await import('../../lib/pdf/helpers/addStoryPage.js');
    const doc = new jsPDF();
    doc.setFontSize(12);
    const sizes = themeSizes(THEMES.pro, 'medium');
    const layout = { width: 160, top: 20, firstTop: 40, bottom: 270, margin: 20, sizes, theme: THEMES.pro };
    const line = 'Une phrase assez longue pour remplir une ligne entière de texte dans la page.';

    // Smallest text that spills 1 or 2 lines onto a second page at normal spacing
    let paragraphs = [];
    let normal;
    do {
      paragraphs = [...paragraphs, line];
      normal = layoutText(doc, paragraphs, layout, 1);
    } while (normal.pages === 1);
    expect(normal.lastPageLines).toBeLessThanOrEqual(2);

    // Tightened by 10 % at most, it fits on one page: this is the layout kept
    expect(chooseLayout(doc, paragraphs, layout).pages).toBe(1);

    // A real overflow (half a page more) is not squeezed
    const longer = [...paragraphs, ...Array(15).fill(line)];
    expect(chooseLayout(doc, longer, layout).pages).toBe(layoutText(doc, longer, layout, 1).pages);
  });

  it('should send the PDF file itself', async () => {
    storyService.findByIds.mockResolvedValue([story('a', 30, 1)]);
    const res = { setHeader: vi.fn(), send: vi.fn(), status: vi.fn(() => res), json: vi.fn() };

    await PDFExportService.exportPdf({ body: { stories: ['a'] } }, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    const sent = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(sent)).toBe(true);
    expect(sent.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('should answer 400 without stories', async () => {
    const res = { setHeader: vi.fn(), send: vi.fn(), status: vi.fn(() => res), json: vi.fn() };
    await PDFExportService.exportPdf({ body: { stories: [] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('server translations', () => {
  it('should read nested keys of the locale files', async () => {
    await init();
    expect(i18n.t('pdf.tocTitle')).toBe('Table des matières');
    expect(i18n.t('pdf.weekDay', { week: 3, day: 'Lundi' })).toBe('Semaine 3 · Lundi');
    expect(i18n.t('unknown.key')).toBe('unknown.key');
  });
});
