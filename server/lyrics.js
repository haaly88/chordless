/**
 * Synced lyrics proxy for LRCLIB (https://lrclib.net) — free, no key.
 * Primary lookup by exact artist/track/duration; falls back to search.
 * Results cached in memory.
 */
import { createCache } from './cache.js';

const cache = createCache({ max: 500, ttlMs: 6 * 60 * 60 * 1000 });
const translateCache = createCache({ max: 200, ttlMs: 24 * 60 * 60 * 1000 });
const LRCLIB = 'https://lrclib.net';
const UA = 'ChordlessWeb/1.0 (https://github.com/kushagrasinghx/Chordless)';
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
