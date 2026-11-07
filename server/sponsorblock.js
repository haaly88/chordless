/**
 * SponsorBlock proxy — crowdsourced timestamps of sponsor/self-promo/
 * non-music sections in YouTube videos, from the public API
 * (https://sponsor.ajay.app, server code: github.com/ajayyy/SponsorBlockServer).
 *
 * The public API answers 404 ("Not Found") when a video has no segments —
 * that is a normal "none" result, not an error. "/api/skipSegments" is the
 * only thing we call. Categories are whitelisted and results cached 1h.
 */
import { createCache } from './cache.js';

const cache = createCache({ max: 500, ttlMs: 60 * 60 * 1000 });
const API = 'https://sponsor.ajay.app/api/skipSegments';
const UA = 'Chordless/1.0 (music client)';

export const ALLOWED_CATEGORIES = new Set([
  'sponsor',
  'selfpromo',
  'interaction',
  'music_offtopic',
  'intro',
  'outro',
  'filler',
  'preview',
]);

export const DEFAULT_CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'music_offtopic'];

export async function getSegments(videoId, categories) {
  const cats = (Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES)
    .filter((c) => ALLOWED_CATEGORIES.has(c));
  if (!videoId || !cats.length) return { found: false, segments: [] };

  const key = `sb:${videoId}:${[...cats].sort().join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `${API}?videoID=${encodeURIComponent(videoId)}&categories=${encodeURIComponent(JSON.stringify(cats))}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { found: false, segments: [], offline: true };
  }

  if (res.status === 404) {
    const payload = { found: false, segments: [] };
    cache.set(key, payload);
    return payload;
  }
  if (!res.ok) return { found: false, segments: [], offline: true };

  let list;
  try {
    list = await res.json();
  } catch {
    return { found: false, segments: [], offline: true };
  }
  const segments = (Array.isArray(list) ? list : [])
    .filter((s) => s?.segment?.length === 2 && s.actionType === 'skip' && Number.isFinite(s.segment[0]) && Number.isFinite(s.segment[1]))
    .map((s) => ({
      start: s.segment[0],
      end: s.segment[1],
      category: s.category,
      uuid: s.UUID,
      votes: s.votes ?? 0,
    }))
    .sort((a, b) => a.start - b.start);

  const payload = { found: true, segments };
  cache.set(key, payload);
  return payload;
}
