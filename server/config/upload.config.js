import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Uploads go to ROOT/uploads
// context: server/config/upload.config.js -> ../ -> server -> ../ -> root
const uploadDir = path.join(__dirname, '../../uploads');

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
    const ext = path.extname(file.originalname);
    const sanitizedName = sanitizeFilename(path.basename(file.originalname, ext));
    const uniqueName = `${uuidv4()}-${sanitizedName}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only jpeg, png, and gif are allowed.'), false);
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
