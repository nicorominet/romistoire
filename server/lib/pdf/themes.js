/**
 * Visual styles of the PDF export. Everything specific to a style lives here: fonts, sizes, colors,
 * and the drawing of the cover, the story header, the page frame and the page number.
 * Drawings only use jsPDF primitives (no decoration images).
 */

const MM_PER_PT = 0.3528;
const YOUNG_AGES = ['2-3', '4-6'];

export const THEMES = {
  /** Young readers: reading font, big text, warm colors, rounded frames. */
  kids: {
    id: 'kids',
    font: { family: 'Andika', dir: 'andika', files: { normal: 'Andika-Regular.ttf', bold: 'Andika-Bold.ttf', italic: 'Andika-Italic.ttf' }, fallback: 'helvetica' },
    bodySizes: { small: 16, medium: 18, large: 20 },
    lineFactor: 1.7,
    paragraphFactor: 1.0,
    indent: 0,
    justify: false,
    margin: 22,
    colors: { title: [91, 61, 179], accent: [245, 158, 11], text: [45, 45, 60], muted: [110, 100, 140], soft: [243, 237, 255], border: [214, 199, 255] }
  },
  /** Teenagers: modern sans-serif, navy and teal, accent bars. */
  teen: {
    id: 'teen',
    font: { family: 'Poppins', dir: 'poppins', files: { normal: 'Poppins-Regular.ttf', bold: 'Poppins-SemiBold.ttf', italic: 'Poppins-Italic.ttf' }, fallback: 'helvetica' },
    bodySizes: { small: 12, medium: 13, large: 14 },
    lineFactor: 1.5,
    paragraphFactor: 0.8,
    indent: 0,
    justify: false,
    margin: 20,
    colors: { title: [22, 33, 62], accent: [13, 148, 136], text: [30, 30, 40], muted: [100, 110, 125], soft: [230, 246, 244], border: [13, 148, 136] }
  },
  /** Book style: reading serif, justified text with indents, running header. */
  pro: {
    id: 'pro',
    font: { family: 'CrimsonText', dir: 'crimsontext', files: { normal: 'CrimsonText-Regular.ttf', bold: 'CrimsonText-Bold.ttf', italic: 'CrimsonText-Italic.ttf' }, fallback: 'times' },
    bodySizes: { small: 11, medium: 12, large: 13 },
    lineFactor: 1.4,
    paragraphFactor: 0.3,
    indent: 6,
    justify: true,
    margin: 22,
    colors: { title: [20, 20, 20], accent: [128, 28, 48], text: [20, 20, 20], muted: [110, 110, 110], soft: [245, 242, 238], border: [128, 28, 48] }
  }
};

export const PDF_STYLES = ['auto', ...Object.keys(THEMES)];

/**
 * Theme of an export: the forced style, or in "auto" the youngest age group of the stories
 * (2-3 or 4-6 → kids, older → teen).
 * @param {{style?: string}} options
 * @param {{age_group?: string}[]} stories
 */
export const resolveTheme = (options = {}, stories = []) => {
  if (THEMES[options.style]) return THEMES[options.style];
  return stories.some(story => YOUNG_AGES.includes(story.age_group)) ? THEMES.kids : THEMES.teen;
};

/**
 * Sizes of an export: the theme's sizes for the "fontSize" option (small / medium / large).
 * @returns {{bodySize: number, lineHeight: number, paragraphSpacing: number, titleSize: number}} pt and mm.
 */
export const themeSizes = (theme, fontSize = 'medium') => {
  const bodySize = theme.bodySizes[fontSize] || theme.bodySizes.medium;
  const bodyMm = bodySize * MM_PER_PT;
  return {
    bodySize,
    lineHeight: bodyMm * theme.lineFactor,
    paragraphSpacing: bodyMm * theme.paragraphFactor,
    titleSize: Math.round(bodySize * (theme.id === 'kids' ? 1.5 : 1.8))
  };
};

const page = (doc) => ({ width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() });

/** Small 5-branch star (kids decorations). */
const star = (doc, cx, cy, radius, color) => {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const deltas = points.slice(1).map((point, i) => [point[0] - points[i][0], point[1] - points[i][1]]);
  doc.setFillColor(...color);
  doc.lines(deltas, points[0][0], points[0][1], [1, 1], 'F', true);
};

/**
 * Cover page.
 * @param {Object} ctx - { theme, family }
 * @param {{title: string, subtitle?: string, count: string, date: string}} text
 */
export const drawCover = (doc, ctx, text) => {
  const { theme, family } = ctx;
  const { width, height } = page(doc);
  const { colors } = theme;
  const textWidth = width - 2 * theme.margin - 10;

  if (theme.id === 'kids') {
    doc.setFillColor(...colors.soft);
    doc.rect(0, 0, width, height, 'F');
    doc.setFillColor(255, 214, 153);
    doc.circle(width * 0.15, height * 0.12, 22, 'F');
    doc.setFillColor(...colors.border);
    doc.circle(width * 0.88, height * 0.85, 30, 'F');
    star(doc, width * 0.82, height * 0.18, 7, colors.accent);
    star(doc, width * 0.2, height * 0.8, 5, colors.title);
    star(doc, width * 0.7, height * 0.72, 4, colors.accent);
  } else if (theme.id === 'teen') {
    doc.setFillColor(...colors.title);
    doc.rect(0, 0, width, height * 0.55, 'F');
    doc.setFillColor(...colors.accent);
    doc.rect(theme.margin, height * 0.55 - 3, 40, 3, 'F');
  } else {
    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(0.4);
    doc.line(width / 2 - 25, height * 0.42, width / 2 + 25, height * 0.42);
  }

  const titleColor = theme.id === 'teen' ? [255, 255, 255] : colors.title;
  doc.setFont(family, 'bold');
  doc.setFontSize(theme.id === 'kids' ? 30 : 28);
  doc.setTextColor(...titleColor);
  const titleLines = doc.splitTextToSize(text.title, textWidth);
  const titleY = theme.id === 'teen' ? height * 0.3 : height * 0.33;
  doc.text(titleLines, width / 2, titleY, { align: 'center' });

  let y = titleY + titleLines.length * 12;
  if (text.subtitle) {
    doc.setFont(family, 'normal');
    doc.setFontSize(14);
    doc.setTextColor(...(theme.id === 'teen' ? [200, 230, 228] : colors.muted));
    const subtitle = doc.splitTextToSize(text.subtitle, textWidth);
    doc.text(subtitle, width / 2, y, { align: 'center' });
    y += subtitle.length * 7;
  }

  doc.setFont(family, 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...colors.muted);
  doc.text(text.count, width / 2, theme.id === 'teen' ? height * 0.65 : y + 14, { align: 'center' });
  doc.setFontSize(10);
  doc.text(text.date, width / 2, height - theme.margin, { align: 'center' });
};

/**
 * Header of a story (title and metadata) from `y`.
 * @param {{label?: string, lines: string[]}} meta - label: "Jour 1 · Lundi"; lines: week, age, tags.
 * @returns {number} y after the header.
 */
export const drawStoryHeader = (doc, ctx, title, meta, y) => {
  const { theme, family, sizes } = ctx;
  const { width } = page(doc);
  const { colors, margin } = theme;
  const textWidth = width - 2 * margin;
  const titleLineHeight = sizes.titleSize * MM_PER_PT * 1.25;

  if (theme.id === 'kids') {
    doc.setFont(family, 'bold');
    doc.setFontSize(sizes.titleSize);
    const lines = doc.splitTextToSize(title, textWidth - 16);
    const bannerHeight = lines.length * titleLineHeight + 12;
    doc.setFillColor(...colors.soft);
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, textWidth, bannerHeight, 6, 6, 'FD');
    star(doc, margin + 7, y + 7, 3.5, colors.accent);
    star(doc, margin + textWidth - 7, y + bannerHeight - 7, 3, colors.title);
    doc.setTextColor(...colors.title);
    doc.text(lines, width / 2, y + 6 + titleLineHeight * 0.8, { align: 'center' });
    y += bannerHeight + 6;
    doc.setFont(family, 'normal');
    doc.setFontSize(Math.max(11, sizes.bodySize - 5));
    doc.setTextColor(...colors.muted);
    const metaLine = [meta.label, ...meta.lines].filter(Boolean).join('  ·  ');
    const wrapped = doc.splitTextToSize(metaLine, textWidth);
    doc.text(wrapped, width / 2, y, { align: 'center' });
    return y + wrapped.length * 5 + 8;
  }

  if (theme.id === 'teen') {
    if (meta.label) {
      doc.setFont(family, 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colors.accent);
      doc.text(meta.label.toUpperCase(), margin + 5, y, { charSpace: 0.6 });
      y += 4 + titleLineHeight * 0.8;
    }
    doc.setFont(family, 'bold');
    doc.setFontSize(sizes.titleSize);
    doc.setTextColor(...colors.title);
    const lines = doc.splitTextToSize(title, textWidth - 5);
    doc.setFillColor(...colors.accent);
    doc.rect(margin, y - titleLineHeight * 0.7, 1.6, (lines.length - 1) * titleLineHeight + titleLineHeight * 0.85, 'F');
    doc.text(lines, margin + 5, y);
    y += lines.length * titleLineHeight + 2;
    doc.setFont(family, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);
    const wrapped = doc.splitTextToSize(meta.lines.join('  ·  '), textWidth - 5);
    doc.text(wrapped, margin + 5, y);
    return y + wrapped.length * 5 + 8;
  }

  // pro
  doc.setFont(family, 'bold');
  doc.setFontSize(sizes.titleSize);
  doc.setTextColor(...colors.title);
  const lines = doc.splitTextToSize(title, textWidth);
  doc.text(lines, width / 2, y + titleLineHeight * 0.4, { align: 'center' });
  y += lines.length * titleLineHeight + 2;
  doc.setDrawColor(...colors.accent);
  doc.setLineWidth(0.3);
  doc.line(width / 2 - 15, y, width / 2 + 15, y);
  y += 6;
  doc.setFont(family, 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...colors.muted);
  const metaLine = [meta.label, ...meta.lines].filter(Boolean).join('  ·  ');
  const wrapped = doc.splitTextToSize(metaLine, textWidth);
  doc.text(wrapped, width / 2, y, { align: 'center' });
  return y + wrapped.length * 5 + 10;
};

/**
 * Frame, running header and page number of a page, drawn once all pages exist.
 * @param {{type: 'cover'|'toc'|'story'|'illustration', storyTitle?: string}} info
 */
export const decoratePage = (doc, ctx, info, pageNumber, total) => {
  const { theme, family } = ctx;
  const { width, height } = page(doc);
  const { colors } = theme;
  if (info.type === 'cover') return;

  if (theme.id === 'kids') {
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(1.2);
    doc.roundedRect(8, 8, width - 16, height - 16, 8, 8, 'S');
    doc.setFillColor(...colors.accent);
    doc.circle(width / 2, height - 12, 5, 'F');
    doc.setFont(family, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(String(pageNumber), width / 2, height - 10.8, { align: 'center' });
    return;
  }

  if (theme.id === 'teen') {
    doc.setFillColor(...colors.accent);
    doc.rect(0, 0, 3, height, 'F');
    doc.setFont(family, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    doc.text(`— ${pageNumber} —`, width / 2, height - 10, { align: 'center' });
    return;
  }

  // pro: running header with the story title, page number at the bottom
  if (info.storyTitle && info.type !== 'toc') {
    doc.setFont(family, 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    const header = doc.splitTextToSize(info.storyTitle, width - 2 * theme.margin)[0];
    doc.text(header, width / 2, 12, { align: 'center' });
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(theme.margin, 14.5, width - theme.margin, 14.5);
  }
  doc.setFont(family, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...colors.muted);
  doc.text(String(pageNumber), width / 2, height - 10, { align: 'center' });
};
