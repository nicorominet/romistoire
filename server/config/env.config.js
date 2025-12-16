import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the server directory (d:\appli-coding\lovable\imagitales\server)
const SERVER_ROOT = path.resolve(__dirname, '..');

// Root of the project (d:\appli-coding\lovable\imagitales)
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

export const ENV_CONFIG = {
  PORT: process.env.API_PORT || process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Absolute path to uploads directory
  UPLOADS_DIR: path.join(PROJECT_ROOT, 'uploads'),
  PROJECT_ROOT // Exporting for use where paths are relative to root
};

console.log('Using Uploads Directory:', ENV_CONFIG.UPLOADS_DIR);
