/**
 * Minimal YouTube Music (InnerTube WEB_REMIX) client — no API key required.
 * Search + home shelves, returning normalized track objects.
 */
import { createCache } from './cache.js';

const YT_BASE = 'https://music.youtube.com/youtubei/v1';
const CLIENT_NAME = 'WEB_REMIX';
const CLIENT_VERSION = '1.20251112.01.00';
const DEFAULT_HL = (process.env.YT_HL || 'en').toLowerCase();
const DEFAULT_GL = (process.env.YT_GL || 'ID').toUpperCase();

/** Normalize a 2-letter country (GL) / language (HL) pair, falling back to env defaults. */
export function normalizeLocale(gl, hl) {
  const cleanGl = String(gl || DEFAULT_GL).trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const cleanHl = String(hl || DEFAULT_HL).trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
  return {
    gl: cleanGl.length === 2 ? cleanGl : DEFAULT_GL,
    hl: cleanHl.length === 2 ? cleanHl : DEFAULT_HL,
  };
}

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Origin: 'https://music.youtube.com',
  'X-YouTube-Client-Name': '67',
  'X-YouTube-Client-Version': CLIENT_VERSION,
};

const searchCache = createCache({ max: 200, ttlMs: 5 * 60 * 1000 });
const homeCache = createCache({ max: 10, ttlMs: 15 * 60 * 1000 });
const playlistCache = createCache({ max: 100, ttlMs: 30 * 60 * 1000 });
const durationCache = createCache({ max: 1000, ttlMs: 6 * 60 * 60 * 1000 });

async function itPost(endpoint, body, locale) {
  const { gl, hl } = normalizeLocale(locale?.gl, locale?.hl);
  const res = await fetch(`${YT_BASE}/${endpoint}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ context: { client: { clientName: CLIENT_NAME, clientVersion: CLIENT_VERSION, hl, gl } }, ...body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`InnerTube ${endpoint} failed: HTTP ${res.status}`);
  return res.json();
}

const runsText = (runs) => (runs || []).map((r) => r.text || '').join('');

/**
 * Track runtime in seconds.
 *
 * The search/home responses do not include runtimes, so we ask the player
 * endpoint for them (cheap, cached for 6 hours).
 */
export async function fetchDuration(videoId, locale) {
  if (!videoId) return 0;
  const cached = durationCache.get(videoId);
  if (cached) return cached;
  try {
    const doc = await itPost('player', { videoId }, locale);
    const seconds = Number(doc?.videoDetails?.lengthSeconds || 0);
    if (seconds > 0) durationCache.set(videoId, seconds);
    return seconds;
  } catch {
    return 0;
  }
}

/** Fill missing runtimes on a list of tracks (bounded, runs in parallel). */
export async function enrichDurations(tracks, locale, limit = 16) {
  if (!Array.isArray(tracks)) return tracks;
  const missing = tracks.filter((t) => t && !t.duration).slice(0, limit);
  if (!missing.length) return tracks;
  await Promise.all(
    missing.map(async (t) => {
      const seconds = await fetchDuration(t.id, locale);
      if (seconds > 0) t.duration = seconds;
    }),
  );
  return tracks;
}

/** Rewrite tiny artwork URLs to high-res variants (yt3/ggpht size suffixes, ytimg quality tiers). */
function upgradeThumb(u) {
  if (!u || typeof u !== 'string') return u;
  let out = u;
  // googleusercontent / ggpht size params: =wNNN-hNNN / =sNNN (keep any -flag suffixes like -l90-rj)
  out = out.replace(/=w\d{2,4}-h\d{2,4}(-\w[\w-]*)?/g, '=w512-h512$1');
  out = out.replace(/=s\d{2,4}(-\w[\w-]*)?/g, '=s1200$1');
  return out;
}

function bestThumb(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return '';
  return upgradeThumb(thumbnails[thumbnails.length - 1].url || thumbnails[0].url || '');
}

function findWatchEndpoint(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.watchEndpoint && node.watchEndpoint.videoId) return node.watchEndpoint;
  for (const value of Object.values(node)) {
    const hit = findWatchEndpoint(value);
    if (hit) return hit;
  }
  return null;
}

export function parseDurationText(text) {
  if (!text) return 0;
  const m = /(?:(\d+):)?(\d{1,2}):(\d{2})/.exec(String(text).trim());
  if (!m) return 0;
  if (m[1] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Duration from a run of texts (e.g. "Tulus • 3:31"): scans from the end and
 * takes the last time-like token, so trailing view counts never win.
 */
export function parseDurationFromParts(parts) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const value = parseDurationText(parts[i]);
    if (value > 0) return value;
  }
  return 0;
}

function classify(subtitle) {
  const s = (subtitle || '').trim();
  if (/^song/i.test(s)) return 'song';
  if (/^video/i.test(s)) return 'video';
  if (/^album/i.test(s)) return 'album';
  if (/^artist/i.test(s)) return 'artist';
  if (/^podcast/i.test(s)) return 'podcast';
  return 'track';
}

/** Matches stats-only columns like "759M plays" / "3.7B views". */
const COUNT_RE = /^[\d.,]+\s*[KMB]?\s*(plays|views|listeners|subscribers)$/i;
const PREFIX_RE = /^(song|video|album|artist|podcast)\b/i;

/**
 * Two subtitle layouts exist in the wild:
 *   search — "Song • The Weeknd • 3.7B plays"    (kind prefix first)
 *   home   — "Backstreet Boys • 759M plays"     (artist first, no prefix)
 */
function artistFromSubtitle(subtitle) {
  const parts = String(subtitle || '').split('•').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return '';
  if (PREFIX_RE.test(parts[0])) return parts.length >= 2 ? parts[1] : '';
  if (parts.length >= 2 && COUNT_RE.test(parts[parts.length - 1])) return parts.slice(0, -1).join(' • ');
  return parts[0];
}

/** Column 3 is either a stats-only cell or the album name. */
function albumFromExtraColumn(cols) {
  const raw = (cols[2] || '').trim();
  if (!raw) return undefined;
  if (COUNT_RE.test(raw)) return undefined;
  return raw;
}

function parseResponsiveListItem(node) {
  const r = node?.musicResponsiveListItemRenderer;
  if (!r) return null;

  const cols = (r.flexColumns || []).map((c) =>
    runsText(c?.musicResponsiveListItemFlexColumnRenderer?.text?.runs),
  );
  const subtitle = cols[1] || '';
  const kind = classify(subtitle);
  if (kind === 'podcast') return null;

  const videoId =
    r?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
      ?.playNavigationEndpoint?.watchEndpoint?.videoId ||
    r?.playlistItemData?.videoId ||
    findWatchEndpoint(r)?.videoId;

  // Artist / album rows may not have a videoId — expose browseId for navigation instead
  if (!videoId) {
    if (kind === 'artist' || kind === 'album') {
      const browseId =
        r?.navigationEndpoint?.browseEndpoint?.browseId ||
        r?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
      if (browseId) {
        return {
          id: browseId.replace(/^(MPRE|OLAK5|MP)/, ''),
          browseId,
          title: cols[0] || 'Unknown',
          artist: kind === 'album' ? (artistFromSubtitle(subtitle) || '') : '',
          kind,
          thumbnail: bestThumb(r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
        };
      }
    }
    return null;
  }

  const fixed = (r.fixedColumns || [])
    .map((c) => runsText(c?.musicResponsiveListItemFixedColumnRenderer?.text?.runs))
    .join(' ');

  return {
    id: videoId,
    title: cols[0] || 'Unknown title',
    artist: artistFromSubtitle(subtitle),
    album: albumFromExtraColumn(cols),
    kind,
    duration: parseDurationText(fixed),
    thumbnail: bestThumb(r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    // Audio quality flags — can be enhanced later with real YouTube Music quality data
    audioQuality: undefined,
    isLossless: false,
    isHiRes: false,
    isDolbyAtmos: false,
  };
}

function parseCardShelf(card) {
  const r = card?.musicCardShelfRenderer;
  if (!r) return null;
  const videoId = findWatchEndpoint(r)?.videoId;
  if (!videoId) return null;
  const subtitle = runsText(r?.subtitle?.runs) || '';
  const kind = classify(subtitle);
  if (kind === 'album' || kind === 'artist' || kind === 'podcast') return null;
  return {
    id: videoId,
    title: runsText(r?.title?.runs) || 'Unknown title',
    artist: artistFromSubtitle(subtitle),
    kind,
    // Card subtitles carry the runtime as their last segment ("… • 3:31").
    duration: parseDurationFromParts(subtitle.split('•').map((s) => s.trim())),
    thumbnail: bestThumb(r?.thumbnail?.thumbnails || r?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
  };
}

function* iterSections(doc) {
  // search: contents.tabbedSearchResultsRenderer.tabs[].tabRenderer.content.sectionListRenderer.contents[]
  const contents = doc?.contents;
  if (contents?.tabbedSearchResultsRenderer) {
    for (const tab of contents.tabbedSearchResultsRenderer.tabs || []) {
      const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const s of sections) yield s;
    }
    return;
  }
  // browse/home: walk generically
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
    if (node.itemSectionRenderer || node.musicCarouselShelfRenderer || node.musicCardShelfRenderer) {
      yield node;
      continue;
    }
    stack.push(...Object.values(node));
  }
}

function itemsFromSection(section) {
  const out = [];
  if (section.musicCardShelfRenderer) {
    const card = parseCardShelf(section);
    if (card) out.push(card);
    return out;
  }
  const inner = section.itemSectionRenderer || section.musicCarouselShelfRenderer;
  for (const item of inner?.contents || []) {
    const parsed = parseResponsiveListItem(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

/**
 * Parse a "musicTwoRowItemRenderer" playlist card from shelves:
 * returns { id, title, subtitle, author, views, thumbnail } — id is the VL id (no VL prefix).
 */
function parseTwoRowItem(node) {
  const r = node?.musicTwoRowItemRenderer;
  if (!r) return null;
  const title = runsText(r?.title?.runs);
  if (!title) return null;
  const browseId =
    r?.navigationEndpoint?.browseEndpoint?.browseId ||
    r?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
  const playlistId = browseId?.replace(/^VL/, '');
  const subRuns = r?.subtitle?.runs || [];
  const subtitle = subRuns.map((x) => x.text || '').join('');
  const author = subRuns.find((x) => x.navigationEndpoint)?.text || subtitle.split('•')[0]?.trim() || '';
  const views = subRuns.find((x) => /views|plays/i.test(x.text || ''))?.text || '';
  return {
    id: playlistId || null,
    title,
    author,
    views,
    subtitle,
    thumbnail: bestThumb(
      r?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      r?.thumbnail?.thumbnails,
    ),
  };
}

/** YT Music playlist details page (browseId = "VL" + playlistId). */
export async function getPlaylist(rawId) {
  const id = String(rawId || '').replace(/^VL/, '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;

  const cacheKey = `playlist:${id}`;
  const cached = playlistCache.get(cacheKey);
  if (cached) return cached;

  const doc = await itPost('browse', { browseId: `VL${id}` });

  // header: musicResponsiveHeaderRenderer (title, meta, thumbnail)
  let header = {};
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
    const h = node.musicResponsiveHeaderRenderer;
    if (h) { header = h; break; }
    stack.push(...Object.values(node));
  }

  const title = runsText(header?.title?.runs) || 'Playlist';
  const secondSub = runsText(header?.secondSubtitle?.runs) || '';
  const firstSub = runsText(header?.subtitle?.runs) || '';
  const meta = [firstSub, secondSub].filter(Boolean).join(' · ');
  const thumbnail = bestThumb(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);

  // tracks: musicPlaylistShelfRenderer contents (same shape as search items)
  const tracks = [];
  const stack2 = [doc];
  while (stack2.length) {
    const node = stack2.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack2.push(...node); continue; }
    if (node.musicPlaylistShelfRenderer) {
      for (const item of node.musicPlaylistShelfRenderer.contents || []) {
        const parsed = parseResponsiveListItem(item);
        if (parsed) tracks.push(parsed);
      }
      continue;
    }
    stack2.push(...Object.values(node));
  }

  const payload = { id, title, meta, thumbnail, tracks };
  playlistCache.set(cacheKey, payload);
  return payload;
}

/** Parse tracks from a browse page's musicRowSectionRenderer / musicShelfRenderer. */
function parseBrowseTracks(doc) {
  const tracks = [];
  const seen = new Set();
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }

    // musicRowSectionRenderer / musicShelfRenderer contain musicResponsiveListItemRenderer rows
    const section = node.musicRowSectionRenderer || node.musicShelfRenderer;
    if (section) {
      for (const item of section.contents || []) {
        const parsed = parseResponsiveListItem(item);
        if (parsed && !seen.has(parsed.id)) {
          seen.add(parsed.id);
          tracks.push(parsed);
        }
      }
      continue;
    }
    stack.push(...Object.values(node));
  }
  return tracks;
}

/** Generic browse page loader — header + tracks. */
async function loadBrowsePage(browseId) {
  const doc = await itPost('browse', { browseId });

  let header = {};
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
    const h = node.musicResponsiveHeaderRenderer;
    if (h) { header = h; break; }
    stack.push(...Object.values(node));
  }

  const title = runsText(header?.title?.runs) || 'Unknown';
  const secondSub = runsText(header?.secondSubtitle?.runs) || '';
  const firstSub = runsText(header?.subtitle?.runs) || '';
  const meta = [firstSub, secondSub].filter(Boolean).join(' · ');
  const thumbnail = bestThumb(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
  const tracks = parseBrowseTracks(doc);

  return { id: browseId.replace(/^(MPRE|OLAK5|MP)/, ''), title, meta, thumbnail, tracks };
}

/** Artist page — top tracks + info. */
export async function getArtist(rawId) {
  const id = String(rawId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
  const cacheKey = `artist:${id}`;
  const cached = playlistCache.get(cacheKey);
  if (cached) return cached;
  const payload = await loadBrowsePage(id);
  payload.kind = 'artist';
  playlistCache.set(cacheKey, payload);
  return payload;
}

/** Album page — tracklist + info. */
export async function getAlbum(rawId) {
  const id = String(rawId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
  const cacheKey = `album:${id}`;
  const cached = playlistCache.get(cacheKey);
  if (cached) return cached;
  const payload = await loadBrowsePage(id);
  payload.kind = 'album';
  playlistCache.set(cacheKey, payload);
  return payload;
}

export async function searchMusic(query, limit = 30, locale) {
  const { gl, hl } = normalizeLocale(locale?.gl, locale?.hl);
  const key = `s:${gl}:${hl}:${query.toLowerCase()}`;
  const cached = searchCache.get(key);
  if (cached) return cached.slice(0, limit);

  const doc = await itPost('search', { query }, { gl, hl });
  let items = [];
  for (const section of iterSections(doc)) items.push(...itemsFromSection(section));
  items = dedupe(items);
  const songs = items.filter((t) => t.kind === 'song');
  const videos = items.filter((t) => t.kind === 'video');
  const rest = items.filter((t) => t.kind !== 'song' && t.kind !== 'video');
  const ordered = [...songs, ...videos, ...rest];
  searchCache.set(key, ordered);
  return ordered.slice(0, limit);
}

function parseBrowseShelves(doc) {
  const shelves = [];
  const playlists = [];
  const seenTitles = new Set();
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
    if (node.musicCarouselShelfRenderer) {
      const shelf = node.musicCarouselShelfRenderer;
      const title = runsText(shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs) || 'For You';
      const playlistShelf = /playlist|community/i.test(title);
      if (playlistShelf) {
        for (const item of shelf.contents || []) {
          const card = parseTwoRowItem(item);
          if (card?.id) playlists.push(card);
        }
        continue;
      }
      const items = dedupe((shelf.contents || []).map(parseResponsiveListItem).filter(Boolean));
      if (items.length >= 3 && !seenTitles.has(title)) {
        seenTitles.add(title);
        shelves.push({ title, items: items.slice(0, 18) });
      }
      continue;
    }
    stack.push(...Object.values(node));
  }
  return { shelves, playlists };
}

/** Localized chart queries per language (fallback: English). Titles stay English for UI consistency. */
const CHART_QUERIES = {
  id: ['lagu trending', 'lagu viral', 'lagu teratas', 'musik baru'],
  ms: ['lagu trending', 'lagu viral', 'lagu teratas', 'muzik baharu'],
  ja: ['トレンド曲', 'バイラル曲', 'チャート曲', '新曲'],
  ko: ['인기곡', '바이러스 곡', '차트 곡', '신곡'],
  zh: ['热门歌曲', '热门歌曲', '榜单歌曲', '新歌'],
  th: ['เพลงยอดนิยม', 'เพลงไวรัล', 'เพลงชาร์ต', 'เพลงใหม่'],
  vi: ['nhạc thịnh hành', 'nhạc viral', 'bản xếp hạng', 'nhạc mới'],
  es: ['canciones de moda', 'canciones virales', 'canciones top', 'musica nueva'],
  fr: ['chansons tendance', 'chansons virales', 'chansons top', 'nouveaute'],
  ar: ['أغاني رائجة', 'أغاني فيروسية', 'أغاني توب', 'موسيقى جديدة'],
  pt: ['musicas em alta', 'musicas virais', 'musicas top', 'musica nova'],
  de: ['trending songs', 'virale songs', 'top songs', 'neue musik'],
};

/** Trending charts — localized to the user's region (GL/HL). */
export async function getCharts(gl, hl) {
  const locale = normalizeLocale(gl, hl);
  const queries = CHART_QUERIES[locale.hl] || ['trending songs', 'viral songs', 'top hits 2026', 'new music'];
  const titles = ['Trending Now', 'Viral Hits', 'Top Charts', 'New Releases'];
  const categories = titles.map((title, i) => ({ title, query: queries[i], limit: 12 }));
  const shelves = [];
  for (const cat of categories) {
    try {
      const items = await searchMusic(cat.query, cat.limit, locale);
      if (items.length) shelves.push({ title: cat.title, items });
    } catch { /* skip category on error */ }
  }
  return shelves;
}

export async function homeShelves(gl, hl) {
  const locale = normalizeLocale(gl, hl);
  const cacheKey = `home:${locale.gl}:${locale.hl}`;
  const cached = homeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const doc = await itPost('browse', { browseId: 'FEmusic_home' }, locale);
    const { shelves, playlists } = parseBrowseShelves(doc);
    if (shelves.length) {
      const payload = { shelves, playlists };
      homeCache.set(cacheKey, payload);
      return payload;
    }
    console.warn('[home] browse returned 0 usable shelves — falling back to search shelves');
  } catch (e) {
    console.error('[home] browse failed:', e.message);
  }

  // Fallback: build shelves from search (separate InnerTube surface, usually works)
  try {
    const fallback = [];
    for (const [title, q] of [['Trending songs', 'top hits'], ['Viral right now', 'viral hits']]) {
      const items = await searchMusic(q, 12, locale);
      if (items.length >= 4) fallback.push({ title, items });
    }
    const payload = { shelves: fallback, playlists: [] };
    if (fallback.length) homeCache.set(cacheKey, payload);
    return payload;
  } catch (e) {
    console.error('[home] fallback failed:', e.message);
    return { shelves: [], playlists: [] };
  }
}
