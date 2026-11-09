/**
 * Synced lyrics proxy for LRCLIB (https://lrclib.net) — free, no key —
 * with an lrc.red (https://lrc.red) fallback when LRCLIB has nothing.
 * Primary lookup by exact artist/track/duration; falls back to search.
 * Results cached in memory.
 */
import { createCache } from './cache.js';

const cache = createCache({ max: 500, ttlMs: 6 * 60 * 60 * 1000 });
const translateCache = createCache({ max: 200, ttlMs: 24 * 60 * 60 * 1000 });
const LRCLIB = 'https://lrclib.net';
const LRC_RED = 'https://lrc.red';
const UA = 'ChordlessWeb/1.0 (https://github.com/kushagrasinghx/Chordless)';
const LRC_RED_UA = 'Chordless/1.0 (https://github.com/kushagrasinghx/Chordless; contact via GitHub)';
const GOOGLE_TRANSLATE = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY = 'https://api.mymemory.translated.net/get';

// libretranslate.de now serves an HTML landing page (not JSON), which made
// translation silently return the original text. Google (auto-detect) is
// primary, MyMemory (line-by-line) is the fallback — both are free, no key.
const SUPPORTED_TARGETS = new Set(['id', 'en', 'ja', 'ko', 'zh', 'th', 'vi', 'es', 'fr', 'ms', 'ar', 'pt', 'de', 'ru']);

function chunkByLines(text, maxChars = 1400) {
  const lines = String(text).split('\n');
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const next = cur ? cur + '\n' + line : line;
    if (next.length > maxChars && cur) { chunks.push(cur); cur = line; }
    else cur = next;
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [String(text)];
}

async function googleTranslateChunk(chunk, target) {
  const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: target, dt: 't', q: chunk });
  const res = await fetch(`${GOOGLE_TRANSLATE}?${params}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json') && !ct.includes('text')) throw new Error('Unexpected content type');
  const data = await res.json();
  if (!Array.isArray(data?.[0])) throw new Error('Unexpected Google response');
  return data[0].map((seg) => seg?.[0] || '').join('');
}

async function googleTranslate(text, target) {
  const chunks = chunkByLines(text);
  const parts = [];
  for (const c of chunks) parts.push(await googleTranslateChunk(c, target));
  return parts.join('\n');
}

async function myMemoryTranslateLine(line, target) {
  const params = new URLSearchParams({ q: line, langpair: `en|${target}` });
  const res = await fetch(`${MYMEMORY}?${params}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || data.responseStatus !== 200) throw new Error('MyMemory returned no translation');
  return translated;
}

async function myMemoryTranslate(text, target) {
  const lines = String(text).split('\n');
  const out = [];
  for (const line of lines) {
    if (!line.trim()) { out.push(line); continue; }
    out.push(await myMemoryTranslateLine(line, target));
  }
  return out.join('\n');
}

async function lrclibFetch(path) {
  const res = await fetch(`${LRCLIB}${path}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB HTTP ${res.status}`);
  return res.json();
}

/** lrc.red search → best hit (duration + name match). */
async function lrcRedSearch(artist, track, duration) {
  const q = encodeURIComponent(`${artist || ''} ${track || ''}`.trim());
  const res = await fetch(`${LRC_RED}/search.json?q=${q}`, {
    headers: { 'User-Agent': LRC_RED_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrc.red HTTP ${res.status}`);
  const data = await res.json();
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  if (!hits.length) return null;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const wantTitle = norm(track);
  const wantArtist = norm(artist);
  const target = Number(duration) || 0;
  const score = (h) => {
    let s = 0;
    const t = norm(h.title);
    const a = norm(h.artist);
    if (wantTitle && t && (t === wantTitle || t.includes(wantTitle) || wantTitle.includes(t))) s -= 1000;
    if (wantArtist && a && (a === wantArtist || a.includes(wantArtist))) s -= 300;
    if (target && h.duration) s += Math.abs(h.duration - target) * 10;
    return s;
  };
  return hits.slice().sort((a, b) => score(a) - score(b))[0] || null;
}

/** Convert TTML timed lines to LRC text (line-level only). */
function ttmlToLrc(ttml) {
  const lines = [];
  const re = /<p[^>]*\bbegin="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  const toSeconds = (v) => {
    const s = String(v).trim();
    if (s.endsWith('ms')) return parseFloat(s) / 1000;
    if (s.endsWith('s')) return parseFloat(s);
    if (s.endsWith('m')) return parseFloat(s) * 60;
    if (s.endsWith('h')) return parseFloat(s) * 3600;
    if (/^\d+:\d+(:\d+(\.\d+)?)?$/.test(s)) return s.split(':').reduce((a, p) => a * 60 + parseFloat(p), 0);
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };
  while ((m = re.exec(ttml))) {
    const secs = toSeconds(m[1]);
    const text = String(m[2] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (!Number.isFinite(secs) || !text) continue;
    const mm = Math.floor(secs / 60);
    const ss = (secs % 60).toFixed(2).padStart(5, '0');
    lines.push(`[${String(mm).padStart(2, '0')}:${ss}] ${text}`);
  }
  return lines.join('\n');
}

/**
 * Totally public catalog fallback via lrc.red (/search.json + /s/{isrc}.lrc).
 * Returns the same payload shape as getLyrics, or null.
 */
async function lrcRedGetLyrics({ artist, track, duration }) {
  const hit = await lrcRedSearch(artist, track, duration);
  if (!hit || !hit.isrc) return null;
  let syncedLyrics = null;
  let plainLyrics = null;
  // .lrc exists only for timed tracks; fall back to TTML when absent.
  try {
    const res = await fetch(`${LRC_RED}/s/${encodeURIComponent(hit.isrc)}.lrc`, {
      headers: { 'User-Agent': LRC_RED_UA },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) syncedLyrics = (await res.text()).trim() || null;
  } catch { /* try TTML below */ }
  if (!syncedLyrics) {
    try {
      const res = await fetch(`${LRC_RED}/s/${encodeURIComponent(hit.isrc)}.ttml`, {
        headers: { 'User-Agent': LRC_RED_UA },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const xml = await res.text();
        const lrc = ttmlToLrc(xml);
        if (lrc) syncedLyrics = lrc;
      }
    } catch { /* untimed / unavailable — plain stays null */ }
  }
  if (!syncedLyrics) return null; // catalog hit has no usable lyrics
  return {
    found: true,
    trackName: hit.title || track,
    artistName: hit.artist || artist || null,
    albumName: hit.album || null,
    duration: hit.duration ?? null,
    instrumental: false,
    syncedLyrics,
    plainLyrics: null,
    source: 'lrc.red',
  };
}

export async function getLyrics({ artist, track, duration, album }) {
  if (!track) return { found: false, reason: 'missing-track' };
  const key = `lyrics:${(artist || '').toLowerCase()}|${track.toLowerCase()}|${Math.round(Number(duration) || 0)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let result = null;
  try {
    const params = new URLSearchParams({ track_name: track });
    if (artist) params.set('artist_name', artist);
    if (album) params.set('album_name', album);
    if (duration && Number(duration) > 0) params.set('duration', String(Math.round(Number(duration))));
    const exact = await lrclibFetch(`/api/get?${params}`);
    if (exact) result = exact;
  } catch { /* fall through to search */ }

  if (!result) {
    try {
      const q = new URLSearchParams({ q: `${track} ${artist || ''}`.trim() });
      const list = await lrclibFetch(`/api/search?${q}`);
      if (Array.isArray(list) && list.length) {
        const target = Number(duration) || 0;
        const score = (i) => (i.syncedLyrics ? 0 : 1e9) + (target ? Math.abs((i.duration || 0) - target) * 10 : 0);
        result = list.slice().sort((a, b) => score(a) - score(b))[0];
      }
    } catch { /* nothing found */ }
  }

  // lrc.red fallback: LRCLIB has nothing, or nothing synced (lrc.red's
  // catalog is ISRC-keyed and often better synced).
  let lrcRedPayload = null;
  if (!result || (!result.syncedLyrics && !result.instrumental)) {
    try {
      lrcRedPayload = await lrcRedGetLyrics({ artist, track, duration });
    } catch (e) {
      console.warn('[lyrics] lrc.red fallback failed:', e.message);
    }
  }

  if (lrcRedPayload && (!result || !result.syncedLyrics)) {
    cache.set(key, lrcRedPayload);
    return lrcRedPayload;
  }

  const payload = result
    ? {
        found: true,
        trackName: result.trackName,
        artistName: result.artistName,
        albumName: result.albumName ?? null,
        duration: result.duration ?? null,
        instrumental: Boolean(result.instrumental),
        syncedLyrics: result.syncedLyrics || null,
        plainLyrics: result.plainLyrics || null,
        source: 'lrclib',
      }
    : { found: false };

  cache.set(key, payload);
  return payload;
}

/** Translate lyrics text. Google (auto-detect) first, MyMemory line-by-line fallback. */
export async function translateLyrics(text, target = 'id') {
  if (!text || !text.trim()) return { translated: '', error: 'No text to translate' };
  const lang = SUPPORTED_TARGETS.has(String(target).toLowerCase()) ? String(target).toLowerCase() : 'id';
  const key = `tr:${lang}:${Buffer.from(text).toString('base64').slice(0, 64)}`;
  const cached = translateCache.get(key);
  if (cached !== undefined) return cached;

  let result = '';
  let lastError = null;
  try {
    result = await googleTranslate(text, lang);
  } catch (e) {
    lastError = e;
    console.warn('[translate] Google failed:', e.message);
  }
  if (!result || !result.trim()) {
    try {
      result = await myMemoryTranslate(text, lang);
    } catch (e) {
      lastError = e;
      console.warn('[translate] MyMemory failed:', e.message);
    }
  }
  if (!result || !result.trim()) {
    // Last resort: return original (UI shows it as-is) but flag the failure.
    result = text;
    const payload = { translated: result, target: lang, error: lastError?.message || 'Translation unavailable' };
    translateCache.set(key, { translated: result, target: lang });
    return payload;
  }

  const payload = { translated: result, target: lang };
  translateCache.set(key, payload);
  return payload;
}
