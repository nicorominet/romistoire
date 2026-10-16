import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../../../config/env.config.js';

const TYPES = { '.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG', '.gif': 'GIF', '.webp': 'WEBP' };

/**
 * Absolute path of an illustration, only when it is an image inside the uploads directory.
 * image_path comes from the request (the client sends the stories): "../../.env" or "/etc/passwd" must never be read.
 * @param {string} imagePath - Stored path, e.g. "uploads/2026-10/x.png" (legacy rows may use "\\").
 * @returns {string|null}
 */
export const resolveIllustrationPath = (imagePath) => {
  if (typeof imagePath !== 'string' || !imagePath) return null;
  const absolutePath = path.resolve(ENV_CONFIG.PROJECT_ROOT, imagePath.replace(/\\/g, '/').replace(/^\/+/, ''));
  const relative = path.relative(ENV_CONFIG.UPLOADS_DIR, absolutePath);
  const insideUploads = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  return insideUploads && TYPES[path.extname(absolutePath).toLowerCase()] ? absolutePath : null;
};

/**
 * Reads an illustration stored in the uploads directory (image_path like "uploads/...").
 * @param {{image_path?: string}} illustration
 * @returns {{data: string, type: string}|null} Data URI and jsPDF image type, or null when the file is missing
 *   or outside the uploads directory.
 */
export const loadImage = (illustration) => {
  if (!illustration?.image_path) return null;
  const absolutePath = resolveIllustrationPath(illustration.image_path);
  if (!absolutePath) {
    console.warn(`[PDF] Illustration path refused: ${illustration.image_path}`);
    return null;
  }
  if (!fs.existsSync(absolutePath)) {
    console.warn(`[PDF] Image not found: ${absolutePath}`);
    return null;
  }
  const type = TYPES[path.extname(absolutePath).toLowerCase()];
  const data = `data:image/${type.toLowerCase()};base64,${fs.readFileSync(absolutePath).toString('base64')}`;
  return { data, type };
};

/**
 * Draws an image inside a box, keeping its ratio, centered horizontally.
 * @returns {number} Height drawn (0 when nothing was drawn).
 */
export const drawImageInBox = (doc, image, { x, y, width, height }) => {
  try {
    const properties = doc.getImageProperties(image.data);
    const ratio = properties.width / properties.height;
    let drawWidth = width;
    let drawHeight = drawWidth / ratio;
    if (drawHeight > height) {
      drawHeight = height;
      drawWidth = drawHeight * ratio;
    }
    doc.addImage(image.data, image.type, x + (width - drawWidth) / 2, y, drawWidth, drawHeight, undefined, 'FAST');
    return drawHeight;
  } catch (error) {
    console.error('[PDF] Image could not be drawn:', error.message);
    return 0;
  }
};
