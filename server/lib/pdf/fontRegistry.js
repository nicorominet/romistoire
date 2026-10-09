import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** Free fonts (SIL Open Font License) shipped in server/assets/fonts. */
export const FONTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');

// TTF files read once, as base64 (jsPDF's virtual file system format)
const cache = new Map();

const readFont = (directory, file) => {
  const fullPath = path.join(directory, file);
  if (!cache.has(fullPath)) {
    cache.set(fullPath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath).toString('base64') : null);
  }
  return cache.get(fullPath);
};

/**
 * Registers the fonts of a theme in the document.
 * @param {import('jspdf').jsPDF} doc
 * @param {{font: {family: string, dir: string, files: {normal: string, bold?: string, italic?: string}, fallback: string}}} theme
 * @param {string} [directory] - Fonts folder (tests).
 * @returns {string} The font family to use: the theme's one, or its standard fallback when a file is missing.
 */
export const registerThemeFonts = (doc, theme, directory = FONTS_DIR) => {
  const { family, dir, files, fallback } = theme.font;
  const folder = path.join(directory, dir);

  const styles = Object.entries(files);
  const data = styles.map(([style, file]) => [style, file, readFont(folder, file)]);
  if (data.some(([, , content]) => !content)) {
    console.warn(`[PDF] Font files missing in ${folder}: using ${fallback}.`);
    return fallback;
  }

  for (const [style, file, content] of data) {
    doc.addFileToVFS(file, content);
    doc.addFont(file, family, style);
  }
  return family;
};
