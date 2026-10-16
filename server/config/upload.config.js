import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ENV_CONFIG } from './env.config.js';
import { IMAGE_EXTENSIONS, MAX_IMAGE_SIZE } from '../../shared/images.js';

const MAX_FILE_SIZE = MAX_IMAGE_SIZE;

// Accepted image types and the extension written on disk (shared with the client)
export { IMAGE_EXTENSIONS };

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
    cb(new InvalidFileTypeError('Invalid file type. Only .json and .zip are allowed.'), false);
  }
};

// Imports (JSON or full ZIP backups, images and audio included): written to the system temp folder,
// never into uploads/ (served to the browser). MAX_IMPORT_MB in .env, 2 GB by default.
const MAX_IMPORT_BYTES = (Number(process.env.MAX_IMPORT_MB) || 2048) * 1024 * 1024;

export const dataUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `romistoire-import-${uuidv4()}${sanitizeFilename(path.extname(file.originalname).toLowerCase())}`)
  }),
  limits: { fileSize: MAX_IMPORT_BYTES },
  fileFilter: dataFileFilter
});
