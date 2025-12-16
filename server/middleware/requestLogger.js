import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../config/env.config.js';

const LOGS_DIR = path.join(ENV_CONFIG.PROJECT_ROOT, 'server', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(LOGS_DIR, `access-${dateStr}.log`);

  // Hook into response finish to calculate duration and status
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      // query: req.query, // Optional: might be noisy
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    fs.appendFile(logFile, logLine, (err) => {
      if (err) console.error('Error writing to log file:', err);
    });
  });

  next();
};
