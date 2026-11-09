/**
 * Update notifier — checks GitHub Releases for a newer version and
 * surfaces a banner + toast. Cached for 6h to stay well under the API
 * rate limit. Works on web and desktop (Electron); Android has an
 * equivalent check (UpdateRepo.kt).
 */
import pkg from '../../package.json';

export const CURRENT_VERSION = pkg.version;
const LATEST_URL = 'https://api.github.com/repos/haaly88/chordless/releases/latest';
const CACHE_KEY = 'cl:updateCache';
const CACHE_TTL = 6 * 60 * 60 * 1000;

export function compareVersions(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForUpdate() {
  try {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    } catch { cached = null; }
    if (cached && Date.now() - cached.at < CACHE_TTL) return cached.result;
    const res = await fetch(LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data?.tag_name) return null;
    const latest = String(data.tag_name).replace(/^v/i, '');
    const result = compareVersions(latest, CURRENT_VERSION) > 0
      ? { available: true, version: latest, url: data.html_url || 'https://github.com/haaly88/chordless/releases' }
      : { available: false, version: latest };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), result }));
    } catch { /* storage full/blocked — still return the result */ }
    return result;
  } catch {
    return null; // offline or API blocked — stay silent
  }
}
