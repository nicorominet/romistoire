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
  // Automatic and manual backups (Settings > Storage)
  BACKUPS_DIR: path.join(PROJECT_ROOT, 'backups'),
  LOGS_DIR: path.join(PROJECT_ROOT, 'server', 'logs'),
  PROJECT_ROOT, // Exporting for use where paths are relative to root

  // Test runs (Vitest) must not write into the real log files
  FILE_LOGGING: !process.env.VITEST
};

console.log('Using Uploads Directory:', ENV_CONFIG.UPLOADS_DIR);
