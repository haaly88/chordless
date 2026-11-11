/**
 * Chordless — stream URL + network-adaptive quality helpers (pure).
 * The store combines these with the user's manual quality setting.
 */

/** Stream URL for a video id, honoring the user's YouTube client & audio quality. */
export function streamSrc(id, qualityOverride) {
  let client = 'auto';
  let quality = 'high';
  let base = '';
  try {
    const s = JSON.parse(localStorage.getItem('cl:settings') || '{}');
    client = s.ytClient || 'auto';
    quality = s.ytQuality || 'high';
    base = String(s.serverUrl || '').trim().replace(/\/+$/, '');
  } catch { /* keep defaults */ }
  if (qualityOverride && ['high', 'medium', 'low'].includes(qualityOverride)) quality = qualityOverride;
  const params = new URLSearchParams();
  if (client !== 'auto') params.set('client', client);
  if (quality !== 'high') params.set('quality', quality);
  const qs = params.toString() ? `?${params}` : '';
  return `${base}/api/stream/${id}${qs}`;
}

/**
 * Warm-up URL: asks the server to resolve the stream ahead of time.
 *
 * Resolving a signed media URL takes a couple of seconds; doing it while the
 * user hovers a row (or while the current track plays) means the actual play
 * request is served from the cache and starts instantly.
 */
export function warmSrc(id, qualityOverride) {
  const base = streamSrc(id, qualityOverride);
  return `${base}${base.includes('?') ? '&' : '?'}warm=1`;
}

/* ---------- network-adaptive quality ---------- */
const Q_ORDER = { high: 3, medium: 2, low: 1 };
const Q_NAME = { 3: 'high', 2: 'medium', 1: 'low' };

export function lowerQuality(a, b) {
  return Q_NAME[Math.min(Q_ORDER[a] || 3, Q_ORDER[b] || 3)];
}

export function qualityFromConnection(conn, stallLevel = 0) {
  if (!conn) {
    if (stallLevel > 0) {
      const lvl = Math.max(1, Math.min(3, Q_ORDER.high - stallLevel));
      return { quality: Q_NAME[lvl], reason: 'stalls' };
    }
    return { quality: 'high', reason: 'auto' };
  }
  const eff = String(conn.effectiveType || '').toLowerCase();
  const down = Number(conn.downlink);
  const rtt = Number(conn.rtt);
  const saveData = Boolean(conn.saveData);
  if (saveData) return { quality: 'low', reason: 'data saver' };
  if (eff === 'slow-2g' || eff === '2g') return { quality: 'low', reason: eff };
  if (eff === '3g' || (Number.isFinite(down) && down < 1.5)) return { quality: 'low', reason: eff || `${down}Mbps` };
  if (Number.isFinite(rtt) && rtt > 800) return { quality: 'medium', reason: `rtt ${rtt}ms` };
  if (eff === '4g' && Number.isFinite(down) && down < 4) return { quality: 'medium', reason: `${down}Mbps` };
  if ((Number.isFinite(down) && down < 4) || eff === '3g') return { quality: 'medium', reason: eff || `${down}Mbps` };
  const base = 'high';
  if (stallLevel > 0) {
    const lvl = Math.max(1, Math.min(3, Q_ORDER[base] - stallLevel));
    return { quality: Q_NAME[lvl], reason: 'stalls' };
  }
  return { quality: base, reason: eff || '4g' };
}

export function connectionSnapshot() {
  try {
    const c = navigator.connection || {};
    return {
      effectiveType: c.effectiveType || null,
      downlink: Number.isFinite(Number(c.downlink)) ? Number(c.downlink) : null,
      rtt: Number.isFinite(Number(c.rtt)) ? Number(c.rtt) : null,
      saveData: Boolean(c.saveData),
    };
  } catch {
    return { effectiveType: null, downlink: null, rtt: null, saveData: false };
  }
}
