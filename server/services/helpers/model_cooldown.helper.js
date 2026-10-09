/**
 * Remembers models that just failed (overloaded, quota exhausted, too slow) so the next calls
 * skip them instead of waiting on them again. In memory, per server process.
 */

export const COOLDOWN_MS = {
  overloaded: 5 * 60 * 1000, // 503 "high demand"
  timeout: 10 * 60 * 1000,
  notFound: 60 * 60 * 1000,
};

/** Milliseconds until the next midnight in the Pacific time zone, when Google resets daily quotas. */
export const msUntilPacificMidnight = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(now).map(part => [part.type, part.value])
  );
  const elapsed = ((Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;
  return 24 * 3600 * 1000 - elapsed;
};

/**
 * Reads a Gemini 429 error: daily quota ("PerDay" quota id or message), or per-minute limit
 * with the delay suggested by the API (RetryInfo "27s").
 * @param {string} errorText - Raw error body.
 * @returns {{daily: boolean, retryDelayMs: number|null}}
 */
export const parseRateLimit = (errorText = '') => {
  const daily = /PerDay|per day|daily/i.test(errorText);
  const delay = errorText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return { daily, retryDelayMs: delay ? Math.ceil(Number(delay[1]) * 1000) : null };
};

export class ModelCooldowns {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.entries = new Map();
  }

  /** Skip `model` for `durationMs`. */
  skip(model, durationMs, reason) {
    this.entries.set(model, { until: this.now() + durationMs, reason });
  }

  /** Why `model` is skipped right now, or null when it is available. */
  reason(model) {
    const entry = this.entries.get(model);
    if (!entry) return null;
    if (entry.until <= this.now()) {
      this.entries.delete(model);
      return null;
    }
    return entry.reason;
  }

  /**
   * Models to try, in priority order. When every model is cooling down, all of them are returned:
   * trying is better than failing without a single request.
   * @returns {{models: string[], skipped: {model: string, reason: string}[]}}
   */
  filter(models) {
    const skipped = models
      .map(model => ({ model, reason: this.reason(model) }))
      .filter(entry => entry.reason);
    const available = models.filter(model => !this.reason(model));
    return available.length > 0 ? { models: available, skipped } : { models: [...models], skipped: [] };
  }

  /**
   * Models paused right now, for display (Settings > AI generation).
   * @returns {{model: string, reason: string, until: string}[]} `until` as an ISO date.
   */
  status() {
    return [...this.entries.keys()]
      .filter(model => this.reason(model))
      .map(model => ({ model, reason: this.entries.get(model).reason, until: new Date(this.entries.get(model).until).toISOString() }));
  }

  clear() {
    this.entries.clear();
  }
}
