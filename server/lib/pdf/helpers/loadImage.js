import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../../../config/env.config.js';

const TYPES = { '.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG', '.gif': 'GIF', '.webp': 'WEBP' };

/**
 * Reads an illustration stored under the project root (image_path like "uploads/...").
 * @param {{image_path?: string}} illustration
 * @returns {{data: string, type: string}|null} Data URI and jsPDF image type, or null when the file is missing.
 */
export const loadImage = (illustration) => {
  if (!illustration?.image_path) return null;
  const absolutePath = path.join(ENV_CONFIG.PROJECT_ROOT, illustration.image_path.replace(/\\/g, '/'));
  if (!fs.existsSync(absolutePath)) {
    console.warn(`[PDF] Image not found: ${absolutePath}`);
    return null;
  }
  const type = TYPES[path.extname(absolutePath).toLowerCase()] || 'JPEG';
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
