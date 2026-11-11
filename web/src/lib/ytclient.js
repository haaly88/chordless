/**
 * Client-side InnerTube client for standalone mode (Android/native).
 * When no backend server is configured and the native InnerTube plugin is
 * available, catalog requests go through the Java bridge (no CORS/bot wall);
 * the response parsing is the same logic as server/innertube.js.
 *
 * On web/dev without the bridge, these functions fall back to direct fetch
 * (which gets blocked by CORS) — the app always prefers the backend there.
 */

function bridge() {
  try {
    return window.Capacitor?.Plugins?.InnerTube || null;
  } catch {
    return null;
  }
}

export function standaloneAvailable() {
  return Boolean(bridge());
}

async function itPost(endpoint, body, locale) {
  const gl = String(locale?.gl || 'ID').toUpperCase();
  const hl = String(locale?.hl || 'en').toLowerCase();
  const b = bridge();
  if (b) {
    const res = await b.post({ endpoint, body: JSON.stringify(body || {}), gl, hl });
    return JSON.parse(res.json);
  }
  // Web/dev fallback — CORS-blocked on music.youtube.com
  const res = await fetch(`https://music.youtube.com/youtubei/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '67',
      'X-YouTube-Client-Version': '1.20251112.01.00',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20251112.01.00', hl, gl } },
      ...(body || {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`InnerTube ${endpoint} failed: HTTP ${res.status}`);
  return res.json();
}

/* ---------- pure parsers (ported from server/innertube.js) ---------- */

const runsText = (runs) => (runs || []).map((r) => r.text || '').join('');

function upgradeThumb(u) {
  if (!u || typeof u !== 'string') return u;
  let out = u;
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

/** Duration from run texts — takes the last time-like token ("… • 3:31"). */
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

const COUNT_RE = /^[\d.,]+\s*[KMB]?\s*(plays|views|listeners|subscribers)$/i;
const PREFIX_RE = /^(song|video|album|artist|podcast)\b/i;

function artistFromSubtitle(subtitle) {
  const parts = String(subtitle || '').split('•').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return '';
  if (PREFIX_RE.test(parts[0])) return parts.length >= 2 ? parts[1] : '';
  if (parts.length >= 2 && COUNT_RE.test(parts[parts.length - 1])) return parts.slice(0, -1).join(' • ');
  return parts[0];
}

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
  const contents = doc?.contents;
  if (contents?.tabbedSearchResultsRenderer) {
    for (const tab of contents.tabbedSearchResultsRenderer.tabs || []) {
      const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const s of sections) yield s;
    }
    return;
  }
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

function headerFromDoc(doc) {
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
  return { title, meta, thumbnail };
}

function browseTracks(doc) {
  const tracks = [];
  const seen = new Set();
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
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

function playlistTracks(doc) {
  const tracks = [];
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
    if (node.musicPlaylistShelfRenderer) {
      for (const item of node.musicPlaylistShelfRenderer.contents || []) {
        const parsed = parseResponsiveListItem(item);
        if (parsed) tracks.push(parsed);
      }
      continue;
    }
    stack.push(...Object.values(node));
  }
  return tracks;
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

/* ---------- public API (same shapes as the backend) ---------- */

export async function searchMusic(query, limit = 30, locale) {
  const doc = await itPost('search', { query }, locale);
  let items = [];
  for (const section of iterSections(doc)) items.push(...itemsFromSection(section));
  items = dedupe(items);
  const songs = items.filter((t) => t.kind === 'song');
  const videos = items.filter((t) => t.kind === 'video');
  const rest = items.filter((t) => t.kind !== 'song' && t.kind !== 'video');
  return [...songs, ...videos, ...rest].slice(0, limit);
}

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

export async function getCharts(gl, hl) {
  const locale = { gl: (gl || 'ID').toUpperCase(), hl: (hl || 'en').toLowerCase() };
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
  const locale = { gl: (gl || 'ID').toUpperCase(), hl: (hl || 'en').toLowerCase() };
  try {
    const doc = await itPost('browse', { browseId: 'FEmusic_home' }, locale);
    const { shelves, playlists } = parseBrowseShelves(doc);
    if (shelves.length) return { shelves, playlists };
  } catch { /* fall through to search shelves */ }
  const fallback = [];
  for (const [title, q] of [['Trending songs', 'top hits'], ['Viral right now', 'viral hits']]) {
    try {
      const items = await searchMusic(q, 12, locale);
      if (items.length >= 4) fallback.push({ title, items });
    } catch { /* skip */ }
  }
  return { shelves: fallback, playlists: [] };
}

export async function getPlaylist(rawId) {
  const id = String(rawId || '').replace(/^VL/, '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
  const doc = await itPost('browse', { browseId: `VL${id}` });
  const { title, meta, thumbnail } = headerFromDoc(doc);
  return { id, title, meta, thumbnail, tracks: playlistTracks(doc) };
}

export async function getArtist(rawId) {
  const id = String(rawId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
  const doc = await itPost('browse', { browseId: id });
  const { title, meta, thumbnail } = headerFromDoc(doc);
  return { id: id.replace(/^(MPRE|OLAK5|MP)/, ''), kind: 'artist', title, meta, thumbnail, tracks: browseTracks(doc) };
}

export async function getAlbum(rawId) {
  const id = String(rawId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
  const doc = await itPost('browse', { browseId: id });
  const { title, meta, thumbnail } = headerFromDoc(doc);
  return { id: id.replace(/^(MPRE|OLAK5|MP)/, ''), kind: 'album', title, meta, thumbnail, tracks: browseTracks(doc) };
}
