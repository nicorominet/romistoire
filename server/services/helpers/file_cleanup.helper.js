import fs from 'fs';
import path from 'path';
import { query } from '../../config/database.js';
import { ENV_CONFIG } from '../../config/env.config.js';

// Audio generated before it moved to uploads/audio (served at /audio)
export const LEGACY_AUDIO_DIR = path.join(ENV_CONFIG.PROJECT_ROOT, 'public', 'audio');
export const AUDIO_DIR = path.join(ENV_CONFIG.UPLOADS_DIR, 'audio');

/**
 * Resolves a stored path ("uploads/2026-10/x.png", "/uploads/audio/x.wav", "/audio/x.wav")
 * to an absolute path, only if it stays inside a managed directory.
 * @param {string} storedPath - Path as stored in DB.
 * @returns {string|null} Absolute path, or null if unknown / outside managed directories.
 */
export const resolveStoredFile = (storedPath) => {
  if (!storedPath) return null;
  const clean = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');

  let root;
  let absolute;
  if (clean.startsWith('uploads/')) {
    root = ENV_CONFIG.UPLOADS_DIR;
    absolute = path.resolve(ENV_CONFIG.PROJECT_ROOT, clean);
  } else if (clean.startsWith('audio/')) {
    root = LEGACY_AUDIO_DIR;
    absolute = path.resolve(LEGACY_AUDIO_DIR, clean.slice('audio/'.length));
  } else {
    return null;
  }
  return absolute.startsWith(root + path.sep) ? absolute : null;
};

const removeFile = (storedPath) => {
  const absolute = resolveStoredFile(storedPath);
  if (!absolute) return false;
  try {
    fs.unlinkSync(absolute);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`[FileCleanup] Could not delete ${absolute}: ${error.message}`);
    return false;
  }
};

/**
 * Deletes media files once no DB row references them anymore.
 * Call after the referencing rows were deleted/updated (and committed).
 */
export const fileCleanup = {
  /**
   * @param {string} imagePath - illustrations.image_path value.
   * @returns {Promise<boolean>} True if the file was deleted.
   */
  async removeImageIfUnused(imagePath) {
    if (!imagePath) return false;
    const normalized = imagePath.replace(/\\/g, '/');
    const rows = await query("SELECT COUNT(*) as total FROM illustrations WHERE REPLACE(image_path, CHAR(92), '/') = ?", [normalized]);
    if (Number(rows[0]?.total) > 0) return false;
    return removeFile(imagePath);
  },

  /**
   * @param {string} audioPath - stories.audio_path value.
   * @returns {Promise<boolean>} True if the file was deleted.
   */
  async removeAudioIfUnused(audioPath) {
    if (!audioPath) return false;
    const rows = await query('SELECT COUNT(*) as total FROM stories WHERE audio_path = ?', [audioPath]);
    if (Number(rows[0]?.total) > 0) return false;
    return removeFile(audioPath);
  }
};
