import { logger } from '../config/logger.js';
import { appendLogLine, datedLogFile } from '../lib/logFiles.js';

/** One line per HTTP request in server/logs/access-<date>.log (Settings > Network > Access). */
export const requestLogger = (req, res, next) => {
  // Settings > Network > Config (kept in memory by the logger, persisted in log-config.json)
  if (logger.getConfig().enableAccessLogging === false) return next();
  const start = Date.now();

  res.on('finish', () => {
    appendLogLine(datedLogFile('access'), {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
};
