/**
 * Story text for the PDF: stored content (editor HTML for generated stories, plain text or markdown
 * for older ones) turned into clean paragraphs, written with jsPDF's standard fonts.
 */

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

/**
 * Text drawable with jsPDF's standard fonts (WinAnsi encoding): accents, « », ’, …, œ are fine;
 * emojis and other symbols are removed, special spaces become normal spaces.
 * @param {string} text
 * @returns {string}
 */
export const pdfSafe = (text) => String(text || '')
  .replace(/[   ]/g, ' ')
  .replace(/[​-‍⁠️]/g, '')
  .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
  .replace(/[←-⯿]/g, '')
  .replace(/[ \t]+/g, ' ')
  // A removed emoji must not leave "riant ." behind
  .replace(/ +([.,)])/g, '$1')
  // French typography: quotes and ; : ! ? stay on the line of their word (no-break space)
  .replace(/« ?/g, '« ')
  .replace(/ ?»/g, ' »')
  .replace(/ ([;:!?])/g, ' $1')
  .trim();

/**
 * Paragraphs of a story, as plain text.
 * - HTML: one paragraph per <p>, <div> or heading, <br> splits too; other tags removed, entities decoded.
 * - Plain text / markdown: one paragraph per blank line; bold markers and [Illustration: …] tags removed.
 * @param {string} content
 * @returns {string[]}
 */
export const storyParagraphs = (content) => String(content || '')
  .replace(/\[\s*(?:Illustration|Description)[^\]]*\]/gi, '')
  .replace(/<\/(?:p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, '\n\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, name) => ENTITIES[name])
  .replace(/\*\*/g, '')
  .replace(/^[ \t]*#+[ \t]*/gm, '')
  .split(/\n\s*\n/)
  .map(paragraph => pdfSafe(paragraph.replace(/\s*\n\s*/g, ' ')))
  .filter(Boolean);
