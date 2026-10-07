import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ENV_CONFIG } from './env.config.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Accepted image types -> extension written on disk.
// The extension never comes from the client file name, so an "image" can't be served as HTML.
// Keep in sync with ACCEPTED_IMAGE_TYPES in src/constants.ts
export const IMAGE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Uploads go to ROOT/uploads (same directory served statically and scanned by the cleanup)
const uploadDir = ENV_CONFIG.UPLOADS_DIR;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organise les uploads par mois/année
    const now = new Date();
    const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(uploadDir, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const originalExt = path.extname(file.originalname);
    const sanitizedName = sanitizeFilename(path.basename(file.originalname, originalExt));
    // Images get the extension of their validated type; data files (json/zip) keep a sanitized one
    const ext = IMAGE_EXTENSIONS[file.mimetype] || sanitizeFilename(originalExt.toLowerCase());
    const uniqueName = `${uuidv4()}-${sanitizedName}${ext}`;
    cb(null, uniqueName);
  }
});

export class InvalidFileTypeError extends Error {}

const fileFilter = (req, file, cb) => {
  if (IMAGE_EXTENSIONS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new InvalidFileTypeError('Invalid file type. Only jpeg, png, gif and webp are allowed.'), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

const dataFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/json', 
    'application/zip', 
    'application/x-zip-compressed',
    'application/octet-stream' // sometimes zips are octet-stream
  ];
  // Also check extension as fallback
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.json', '.zip'];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .json and .zip are allowed.'), false);
  }
};

export const dataUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Increase limit for backups (50MB)
  fileFilter: dataFileFilter
});
