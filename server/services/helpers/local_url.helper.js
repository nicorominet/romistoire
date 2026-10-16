import net from 'net';

/**
 * Whether a host is this machine or the local network: the Ollama URL (Settings > AI) may only point there,
 * so the API can never be used to reach another server (cloud metadata 169.254.169.254, internet hosts).
 * Accepted: localhost, single-label names ("nas"), *.local / *.lan / *.home.arpa / *.localhost,
 * host.docker.internal, loopback and private IPv4 / IPv6 addresses.
 * @param {string} hostname - URL hostname (IPv6 inside brackets accepted).
 * @returns {boolean}
 */
export const isLocalHost = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return false;

  if (net.isIPv4(host)) {
    const [a, b] = host.split('.').map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(host)) {
    if (host === '::1') return true;
    // IPv4-mapped (::ffff:192.168.1.2)
    const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isLocalHost(mapped[1]);
    // Unique local fc00::/7 (link-local fe80::/10 is left out, like 169.254.0.0/16)
    return /^f[cd][0-9a-f]{2}:/.test(host);
  }

  if (host === 'localhost' || host === 'host.docker.internal') return true;
  if (!host.includes('.')) return true;
  return /\.(local|lan|localhost|home\.arpa|internal)$/.test(host);
};

/**
 * @param {string} value - URL to check.
 * @returns {string|null} Error message, or null when the URL is an http(s) URL of the local network.
 */
export const localUrlError = (value) => {
  let url;
  try { url = new URL(String(value).trim()); } catch (e) { return 'is not a valid URL'; }
  if (!['http:', 'https:'].includes(url.protocol)) return 'must start with http:// or https://';
  if (!isLocalHost(url.hostname)) return 'must point to this machine or the local network';
  return null;
};
