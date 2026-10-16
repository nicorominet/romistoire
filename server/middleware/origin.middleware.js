/**
 * The API has no login: it must only answer the app itself, never another website open in the same browser
 * (a page on any site could otherwise call DELETE /api/reset-data on localhost).
 */

// Vite dev server (vite.config.ts) and the API itself; ALLOWED_ORIGINS (comma separated) replaces the list
const DEFAULT_ORIGINS = ['http://localhost:8885', 'http://127.0.0.1:8885'];

/** @returns {string[]} Origins allowed to call the API from a browser. */
export const allowedOrigins = (env = process.env) => {
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_ORIGINS;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Whether a request comes from the app (or from a non-browser client such as curl or a script).
 * The app's own origin (API serving the build) is always allowed.
 */
export const isTrustedRequest = (req, origins) => {
  const origin = req.get('origin');
  if (origin) {
    return origins.includes(origin) || origin === `${req.protocol}://${req.get('host')}`;
  }
  // No Origin: browsers still say where the request comes from (old browsers send neither header)
  return req.get('sec-fetch-site') !== 'cross-site';
};

/**
 * Refuses (403) the requests that change data when they come from another website.
 * Reads are covered by CORS: a foreign page cannot read the answers.
 */
export const originGuard = (origins = allowedOrigins()) => (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || isTrustedRequest(req, origins)) return next();
  res.status(403).json({ error: 'Origin not allowed' });
};
