import fs from 'fs';
import path from 'path';
import { query } from '../config/database.js';
import { modelLimits, peakPerMinute, quotaDayStart } from './helpers/model_limits.helper.js';

export const AI_OUTCOMES = ['ok', 'rate_limit', 'daily_quota', 'overloaded', 'timeout', 'error'];

const toSql = (date) => date.toISOString().slice(0, 23).replace('T', ' ');

/**
 * Every request sent to Gemini, successful or not, so the quota use can be checked afterwards
 * (requests per minute and per day, 429 answers). Settings > AI generation.
 */
class AiUsageService {
  constructor() {
    // Test runs do not write into the real table (enabled again by the tests that need it)
    this.enabled = !process.env.VITEST;
  }

  /**
   * Records one request. Never throws: statistics must not break a generation.
   * @param {{at: Date, model: string, label: string, outcome: string, httpStatus?: number|null, durationMs?: number|null}} entry
   */
  record({ at, model, label, outcome, httpStatus = null, durationMs = null }) {
    if (!this.enabled) return Promise.resolve();
    return query(
      'INSERT INTO ai_requests (at, model, label, outcome, http_status, duration_ms) VALUES (?, ?, ?, ?, ?, ?)',
      [toSql(at), model, String(label || '').slice(0, 50), AI_OUTCOMES.includes(outcome) ? outcome : 'error', httpStatus, durationMs]
    ).catch(error => console.error('[AiUsage] Could not record a request:', error.message));
  }

  /**
   * Use per model over the last days, and over the current quota day (Pacific time).
   * @param {{days?: number, now?: Date}} [options]
   * @returns {Promise<{dayStart: string, days: number, models: Object[]}>}
   */
  async usage({ days = 7, now = new Date() } = {}) {
    const dayStart = quotaDayStart(now);
    const since = new Date(Math.min(dayStart.getTime(), now.getTime() - days * 24 * 3600 * 1000));
    const rows = await query(
      'SELECT at, model, outcome FROM ai_requests WHERE at >= ? ORDER BY at ASC',
      [toSql(since)]
    );

    const byModel = new Map();
    for (const row of rows) {
      const at = row.at instanceof Date ? row.at : new Date(`${String(row.at).replace(' ', 'T')}Z`);
      if (!byModel.has(row.model)) byModel.set(row.model, []);
      byModel.get(row.model).push({ at: at.getTime(), outcome: row.outcome });
    }

    const models = [...byModel.entries()].map(([model, requests]) => {
      const today = requests.filter(r => r.at >= dayStart.getTime());
      const count = (list, outcome) => list.filter(r => r.outcome === outcome).length;
      const limited = requests.filter(r => r.outcome === 'rate_limit' || r.outcome === 'daily_quota');
      const limits = modelLimits(model);
      const todayPeak = peakPerMinute(today.map(r => r.at));
      return {
        model,
        limits,
        today: {
          requests: today.length,
          ok: count(today, 'ok'),
          peakPerMinute: todayPeak,
          rateLimited: count(today, 'rate_limit'),
          dailyQuota: count(today, 'daily_quota')
        },
        period: {
          requests: requests.length,
          ok: count(requests, 'ok'),
          peakPerMinute: peakPerMinute(requests.map(r => r.at)),
          rateLimited: count(requests, 'rate_limit'),
          dailyQuota: count(requests, 'daily_quota'),
          overloaded: count(requests, 'overloaded'),
          timeouts: count(requests, 'timeout'),
          errors: count(requests, 'error'),
          lastLimitedAt: limited.length ? new Date(limited[limited.length - 1].at).toISOString() : null
        },
        // A limit was hit: Google answered 429, or the counted use reached the indicative limit
        exceeded: limited.length > 0
          || (limits.rpm !== null && todayPeak >= limits.rpm)
          || (limits.rpd !== null && today.length >= limits.rpd)
      };
    }).sort((a, b) => b.period.requests - a.period.requests);

    return { dayStart: dayStart.toISOString(), days, models };
  }

  /**
   * First start with the statistics: the successful Gemini requests already in the AI logs
   * (server/logs/ai-*.log) are imported once, so the use before this version shows up too.
   * Failed requests were not logged with their model: they cannot be imported.
   * @param {string} logsDir
   * @returns {Promise<number>} Requests imported (0 when the table already has data).
   */
  async importFromAiLogs(logsDir) {
    if (!this.enabled || !fs.existsSync(logsDir)) return 0;
    const [{ total }] = await query('SELECT COUNT(*) AS total FROM ai_requests');
    if (Number(total) > 0) return 0;

    let imported = 0;
    for (const file of fs.readdirSync(logsDir).filter(name => /^ai-\d{4}-\d{2}-\d{2}\.log$/.test(name)).sort()) {
      for (const line of fs.readFileSync(path.join(logsDir, file), 'utf8').split('\n')) {
        let entry;
        try { entry = JSON.parse(line); } catch (e) { continue; }
        const meta = entry?.meta;
        const model = meta?.output?.model;
        // One line per answered request (the "-Parsed" lines describe the same request)
        if (meta?.provider !== 'Gemini' || !model || /-Parsed$|-Error$/.test(meta.type || '')) continue;
        const end = Date.parse(entry.timestamp);
        if (Number.isNaN(end)) continue;
        const durationMs = Number(meta.duration) || 0;
        await this.record({ at: new Date(end - durationMs), model, label: meta.type, outcome: 'ok', httpStatus: 200, durationMs });
        imported++;
      }
    }
    return imported;
  }

  /** Deletes the requests older than `days` (log retention). */
  async purge(days) {
    const limit = new Date(Date.now() - days * 24 * 3600 * 1000);
    const result = await query('DELETE FROM ai_requests WHERE at < ?', [toSql(limit)]);
    return result?.affectedRows ?? 0;
  }
}

export const aiUsageService = new AiUsageService();
