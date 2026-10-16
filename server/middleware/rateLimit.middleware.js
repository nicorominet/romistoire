/**
 * Requests per client and per minute on the routes that spend AI quota or server resources.
 * Fixed window, in memory (one API process). Limits sit well above what the pages do on purpose
 * (the illustration workshop and the topic suggestions call the AI one request after the other):
 * they stop a runaway loop or an abuse, never a normal use.
 */
const WINDOW_MS = 60 * 1000;

const windows = new Map();

// Old windows are dropped once a minute (unref: never keeps the process alive)
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (now - window.start >= WINDOW_MS) windows.delete(key);
  }
}, WINDOW_MS).unref();

/**
 * @param {string} name - Bucket shared by the routes of a kind (e.g. "ai-text").
 * @param {number} max - Requests allowed per minute and per client.
 * @returns {import('express').RequestHandler} 429 with Retry-After beyond the limit.
 */
export const rateLimit = (name, max) => (req, res, next) => {
  const key = `${name}:${req.ip}`;
  const now = Date.now();
  let window = windows.get(key);
  if (!window || now - window.start >= WINDOW_MS) {
    window = { start: now, count: 0 };
    windows.set(key, window);
  }
  window.count++;
  if (window.count <= max) return next();
  const retryAfter = Math.ceil((window.start + WINDOW_MS - now) / 1000);
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({ error: `Too many requests, try again in ${retryAfter}s` });
};

/** Limits of the app, per minute and per client. */
export const LIMITS = {
  aiText: rateLimit('ai-text', 60),       // illustration prompts, topic suggestions, week audits
  aiAudio: rateLimit('ai-audio', 20),     // story audio, voice samples
  jobs: rateLimit('jobs', 30),            // new / replayed generation jobs
  ollamaTest: rateLimit('ollama-test', 30),
  pdf: rateLimit('pdf', 20),
  backup: rateLimit('backup', 10),
  clientLogs: rateLimit('client-logs', 120) // the client sends a batch every 2 s at most
};

/** Test helper: forgets every window.
 * @internal
 */
export const resetRateLimits = () => windows.clear();
