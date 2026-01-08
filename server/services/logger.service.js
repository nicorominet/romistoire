import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../config/env.config.js';

/**
 * Service for handling application logging.
 * Logs to console and writes to daily access log files.
 */
class LoggerService {
  constructor() {
    this.levels = {
      INFO: 'INFO',
      WARN: 'WARN',
      ERROR: 'ERROR',
      DEBUG: 'DEBUG',
    };
    this.logsDir = path.join(ENV_CONFIG.PROJECT_ROOT, 'server', 'logs');
    if (!fs.existsSync(this.logsDir)) {
      try {
        fs.mkdirSync(this.logsDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create logs directory', err);
      }
    }
  }

  /**
   * Formats a log message.
   * @private
   * @param {string} level - Log level.
   * @param {string} message - Log message.
   * @param {Object} meta - Additional metadata.
   * @returns {string} Formatted log string.
   */
  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaString}`;
  }

  /**
   * Log AI interaction.
   * @param {string} provider - 'Gemini' or 'Ollama'.
   * @param {string} type - 'Story' or 'Audio'.
   * @param {Object} input - input prompt/params.
   * @param {Object} output - output text/audio metadata.
   * @param {Object} meta - Additional metadata (duration, model, etc).
   */
  ai(provider, type, input, output, meta = {}) {
    const message = `AI Interaction: ${provider} [${type}]`;
    const fullMeta = { ...meta, provider, type, input, output };
    
    // Console log for immediate feedback (brief)
    console.log(`[AI] ${provider} ${type} - ${meta.duration}ms`);

    this._writeToFile('AI', message, fullMeta, 'ai');
  }

  /**
   * Writes log entry to file.
   * @private
   * @param {string} level - Log level.
   * @param {string} message - Log message.
   * @param {Object} meta - Additional metadata.
   * @param {string} [logType='access'] - Type of log file prefix (access or ai).
   */
  _writeToFile(level, message, meta = {}, logType = 'access') {
    try {
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(this.logsDir, `${logType}-${dateStr}.log`); 
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        meta,
        type: logType
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      fs.appendFile(logFile, logLine, (err) => {
        if (err) console.error('Error writing to log file:', err);
      });
    } catch (error) {
      console.error('LoggerService file write failed:', error);
    }
  }

  /**
   * Log info level message.
   * @param {string} message - Message to log.
   * @param {Object} [meta] - Additional metadata.
   */
  info(message, meta = {}) {
    console.log(this._formatMessage(this.levels.INFO, message, meta));
    this._writeToFile(this.levels.INFO, message, meta, 'access');
  }

  /**
   * Log warning level message.
   * @param {string} message - Message to log.
   * @param {Object} [meta] - Additional metadata.
   */
  warn(message, meta = {}) {
    console.warn(this._formatMessage(this.levels.WARN, message, meta));
    this._writeToFile(this.levels.WARN, message, meta, 'access');
  }

  /**
   * Log error level message.
   * @param {string} message - Message to log.
   * @param {Object} [meta] - Additional metadata.
   * @param {Error} [error] - Error object.
   */
  error(message, meta = {}, error = null) {
    let errorMessage = this._formatMessage(this.levels.ERROR, message, meta);
    if (error) {
      errorMessage += `\nStack Trace: ${error.stack || error}`;
      meta.error = error.message || error;
      meta.stack = error.stack;
    }
    console.error(errorMessage);
    this._writeToFile(this.levels.ERROR, message, meta, 'access');
  }

  /**
   * Log debug level message.
   * Only logs in non-production environments.
   * @param {string} message - Message to log.
   * @param {Object} [meta] - Additional metadata.
   */
  debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this._formatMessage(this.levels.DEBUG, message, meta));
      // Optional: don't write debug to file to save space, or write it. Let's skip file for debug.
    }
  }
}

export const logger = new LoggerService();
