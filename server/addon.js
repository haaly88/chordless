/**
 * Lossless addon client — BitChord-compatible HTTP addons.
 *
 * An addon is a base URL hosting three routes:
 *   GET {base}/manifest.json  → { id, name, version, resources: [search, stream, ...], settings? }
 *   GET {base}/search?q=…     → { tracks: [...] }
 *   GET {base}/stream/{id}    → { url, format, codec, container, quality, sampleRate, bitDepth, ... }
 *
 * The browser never contacts the addon directly (CORS, credentials, uptime):
 * everything goes through this local proxy, mirroring how YouTube streams work.
 */
import { createCache } from './cache.js';

const manifestCache = createCache({ max: 50, ttlMs: 10 * 60 * 1000 });
const searchCache = createCache({ max: 200, ttlMs: 10 * 60 * 1000 });
const UA = 'Chordless/1.0 (music client)';

/** Normalize a user-supplied addon reference to an absolute base URL (no trailing slash), or null if invalid. */
export function normalizeBase(raw) {
  const input = String(raw || '').trim();
  if (!input) return null;
  let url;
  try { url = new URL(input); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  if (isBlockedHost(url.hostname)) return null;
  // allow either "…/a" or "…/a/manifest.json" — both mean the same base
  const path = url.pathname.replace(/\/+$/, '').replace(/\/manifest\.json$/i, '');
  return url.origin + path;
}

/** Block loopback / link-local / private hosts to prevent SSRF from the proxy. */
function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.local') || h === '::1') return true;
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const a = Number(ip[1]), b = Number(ip[2]);
    if (a === 10 || a === 127 || a === 0) return true; // private + loopback
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a >= 224) return true; // multicast / reserved
  }
  if (/^(fc|fd|fe8|fe9|fea|feb)/i.test(h)) return true; // IPv6 unique-local/link-local
  return false;
}

function scoreName(a, b) { return (a || '').trim().toLowerCase().includes((b || '').trim().toLowerCase()) ? 1 : 0; }

export async function getManifest(rawBase) {
  const base = normalizeBase(rawBase);
  if (!base) return null;
  const cacheKey = `manifest:${base}`;
  const cached = manifestCache.get(cacheKey);
  if (cached) return cached;

  let res;
  try {
    res = await fetch(`${base}/manifest.json`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let json;
  try { json = await res.json(); } catch { return null; }
  if (!json || typeof json !== 'object') return null;
  const id = String(json.id || '').trim();
  const name = String(json.name || '').trim();
  const resources = Array.isArray(json.resources) ? json.resources.map(String) : [];
  if (!id || !name || !resources.includes('search') || !resources.includes('stream')) return null;
  const settings = Array.isArray(json.settings) ? json.settings : [];
  const qualitySetting = settings.find((s) => String(s.key || '').toLowerCase() === 'quality');
  const qualityOptions = Array.isArray(qualitySetting?.options) ? qualitySetting.options.map((o) => String(o.value)) : ['LOSSLESS'];
  const defaultQuality = qualitySetting?.default && qualityOptions.includes(String(qualitySetting.default)) ? String(qualitySetting.default) : (qualityOptions[0] || 'LOSSLESS');

  const payload = { base, id, name, version: String(json.version || ''), resources, qualityOptions, defaultQuality };
  manifestCache.set(cacheKey, payload);
  return payload;
}

export async function searchAddon(rawBase, rawQuality, query, limit = 25) {
  const base = normalizeBase(rawBase);
  if (!base) return { found: false, tracks: [] };
  const q = String(query || '').trim();
  if (q.length < 2) return { found: true, tracks: [] };
  const quality = String(rawQuality || 'LOSSLESS');
  const cacheKey = `search:${base}:${quality}:${q.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  let res;
  try {
    const url = `${base}/search?${new URLSearchParams({ q, quality })}`;
    res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
  } catch {
    return { found: false, tracks: [] };
  }
  if (!res.ok) return { found: false, tracks: [] };
  let json;
  try { json = await res.json(); } catch { return { found: false, tracks: [] }; }
  const rawTracks = Array.isArray(json?.tracks) ? json.tracks : [];
  const seen = new Set();
  const tracks = [];
  for (const raw of rawTracks) {
    const id = String(raw?.id || '').trim();
    const title = String(raw?.title || '').trim();
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const duration = Number(raw?.duration);
    tracks.push({
      id,
      title,
      artist: String(raw?.artist || 'Unknown artist').trim(),
      album: raw?.album ? String(raw.album).trim() : '',
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      thumbnail: String(raw?.artworkURL || raw?.albumArtworkURL || '').trim(),
      audioQuality: String(raw?.audioQuality || 'LOSSLESS').trim(),
      format: String(raw?.format || 'flac').trim() || 'flac',
      isAddon: true,
      addonBase: base,
    });
    if (tracks.length >= limit) break;
  }
  const payload = { found: true, tracks };
  searchCache.set(cacheKey, payload);
  return payload;
}

const streamCache = createCache({ max: 100, ttlMs: 2 * 60 * 1000 });

export async function resolveAddonStream(rawBase, rawQuality, id) {
  const base = normalizeBase(rawBase);
  const quality = String(rawQuality || 'LOSSLESS');
  if (!base || !id) return null;
  const cacheKey = `stream:${base}:${quality}:${id}`;
  const cached = streamCache.get(cacheKey);
  if (cached) return cached;
  let res;
  try {
    // prefer=progressive forces unified/Tidal addons to return direct FLAC
    // instead of a DASH MPD manifest that <audio> cannot play in browsers.
    // Qobuz/Deezer addons ignore unknown params, so this is safe for them.
    const params = new URLSearchParams({ quality, prefer: 'progressive' });
    res = await fetch(`${base}/stream/${encodeURIComponent(id)}?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let json;
  try { json = await res.json(); } catch { return null; }
  const url = String(json?.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  // DASH MPD manifests are not playable via <audio> — treat as unplayable
  // so the UI can offer the YouTube fallback instead of a broken stream.
  const manifestKind = String(json?.manifest || '').toLowerCase();
  const mime = String(json?.mimeType || '').toLowerCase();
  if (manifestKind === 'dash' || mime.includes('dash')) return null;
  // Cache the resolved CDN URL briefly — it typically carries an short expiry token
  const info = {
    url,
    format: String(json?.format || 'flac'),
    codec: String(json?.codec || json?.format || 'flac'),
    container: String(json?.container || json?.format || 'flac'),
    quality: String(json?.quality || quality),
    sampleRate: Number(json?.sampleRate) || null,
    bitDepth: Number(json?.bitDepth) || null,
    bitrate: Number(json?.bitrate) || null,
    mimeType: String(json?.mimeType || 'audio/flac'),
  };
  streamCache.set(cacheKey, info, 2 * 60 * 1000);
  return info;
}

export async function testAddon(rawBase) {
  const manifest = await getManifest(rawBase);
  if (!manifest) return { ok: false, error: 'Addon manifest tidak valid atau tidak bisa dijangkau.' };
  try {
    const probe = await searchAddon(manifest.base, manifest.defaultQuality, 'test', 1);
    if (!probe.found) return { ok: false, error: 'Addon tidak menanggapi pencarian.', manifest };
    return { ok: true, manifest };
  } catch {
    return { ok: false, error: 'Addon tidak menanggapi pencarian.', manifest };
  }
}
