import { log as appLog } from '../config/logger.js';
import { appendLogLine, datedLogFile } from '../lib/logFiles.js';

/**
 * Server messages and AI exchanges.
 * - info / warn / error: console, and the application log (server/debug/logs.jsonl, category SYSTEM),
 *   next to the SQL and client logs. The access log stays for HTTP requests only.
 * - ai: server/logs/ai-<date>.log, one exchange per line (read back by the quota statistics).
 * File writes go through server/lib/logFiles.js.
 */
class LoggerService {
  /**
   * @private
   * @returns {string} "[2026-10-16T12:00:00.000Z] [INFO] message {meta}"
   */
  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaString}`;
  }

  /**
   * Log AI interaction.
   * @param {string} provider - 'Gemini' or 'Ollama'.
   * @param {string} type - 'Story', 'Audio', 'Story-Parsed'...
   * @param {Object} input - input prompt/params.
   * @param {Object} output - output text/audio metadata.
   * @param {Object} meta - Additional metadata (duration, model, etc).
   */
  ai(provider, type, input, output, meta = {}) {
    // Console: one short line, the full exchange goes to the file
    console.log(`[AI] ${provider} ${type}${meta.duration !== undefined ? ` - ${meta.duration}ms` : ''}`);
    appendLogLine(datedLogFile('ai'), {
      timestamp: new Date().toISOString(),
      level: 'AI',
      message: `AI Interaction: ${provider} [${type}]`,
      meta: { ...meta, provider, type, input, output },
      type: 'ai'
    });
  }

  /**
   * @param {string} message
   * @param {Object} [meta]
   */
  info(message, meta = {}) {
    console.log(this._formatMessage('INFO', message, meta));
    appLog('SYSTEM', message, meta, 'INFO', { console: false });
  }

  /**
   * @param {string} message
   * @param {Object} [meta]
   */
  warn(message, meta = {}) {
    console.warn(this._formatMessage('WARN', message, meta));
    appLog('SYSTEM', message, meta, 'WARN', { console: false });
  }

  /**
   * @param {string} message
   * @param {Object} [meta]
   * @param {Error} [error] - Its message and stack are logged too.
   */
  error(message, meta = {}, error = null) {
    const details = error ? { ...meta, error: error.message || String(error), stack: error.stack } : meta;
    let errorMessage = this._formatMessage('ERROR', message, meta);
    if (error) errorMessage += `\nStack Trace: ${error.stack || error}`;
    console.error(errorMessage);
    appLog('SYSTEM', message, details, 'ERROR', { console: false });
  }

  /**
   * Console only, outside production.
   * @param {string} message
   * @param {Object} [meta]
   */
  debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this._formatMessage('DEBUG', message, meta));
    }
  }
}

export const logger = new LoggerService();
