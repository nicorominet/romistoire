/**
 * Free tier limits of the Gemini models, by model family (indicative: Google changes them, the API
 * gives no way to read them). Read on the AI Studio "Rate limits" page on 2026-10-09.
 * First match wins: TTS before Flash Lite (gemini-3.8-flash-lite-tts), 2.5 Flash Lite before the other Flash Lite.
 * null = unknown (not shown as a limit).
 */
const LIMITS = [
  // Every TTS model: 3 per minute, 10 per day (10K tokens per minute)
  { test: /^gemini-.*-tts/, rpm: 3, rpd: 10 },
  { test: /^gemini-2\.5-flash-lite/, rpm: 10, rpd: 20 },
  { test: /^gemini-.*-flash-lite/, rpm: 15, rpd: 500 },
  { test: /^gemini-.*-flash(?:-preview)?$/, rpm: 5, rpd: 20 },
  { test: /^gemma-/, rpm: 30, rpd: 14400 },
];

/**
 * @param {string} model - Model id.
 * @returns {{rpm: number|null, rpd: number|null}} Requests per minute and per day of the free tier.
 */
export const modelLimits = (model) => {
  const entry = LIMITS.find(limit => limit.test.test(String(model || '')));
  return entry ? { rpm: entry.rpm, rpd: entry.rpd } : { rpm: null, rpd: null };
};

/**
 * Start of the current quota day: Google resets the daily quotas at midnight, Pacific time.
 * @param {Date} [now]
 * @returns {Date}
 */
export const quotaDayStart = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(now).map(part => [part.type, part.value])
  );
  const elapsedMs = ((Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000;
  return new Date(Math.floor((now.getTime() - elapsedMs) / 1000) * 1000);
};

/**
 * Largest number of requests started within any 60 s window.
 * @param {number[]} times - Start times (ms), any order.
 */
export const peakPerMinute = (times) => {
  const sorted = [...times].sort((a, b) => a - b);
  let peak = 0;
  let first = 0;
  for (let last = 0; last < sorted.length; last++) {
    while (sorted[last] - sorted[first] >= 60000) first++;
    peak = Math.max(peak, last - first + 1);
  }
  return peak;
};
