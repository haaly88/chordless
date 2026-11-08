import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { searchMusic, homeShelves, getPlaylist, getCharts, getArtist, getAlbum, normalizeLocale } from './innertube.js';
import { getSegments, DEFAULT_CATEGORIES } from './sponsorblock.js';
import { isValidVideoId, streamAudio, ytDlpAvailable, pipeUpstream } from './stream.js';
import { getManifest, searchAddon, resolveAddonStream, testAddon, normalizeBase } from './addon.js';
import { getLyrics, translateLyrics } from './lyrics.js';
import { importFromUrl } from './import.js';
import { getChapters } from './chapters.js';
import { createShare, getShare } from './share.js';
import { coverImage } from './cover.js';
import { createRoom, joinRoom, getRoom, pushState, pushPresence, pushChat, leaveRoom } from './together.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WEB_DIST = path.join(ROOT, 'web', 'dist');
const PORT = Number(process.env.PORT) || 3001;
const HOST = String(process.env.HOST || '127.0.0.1');
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.set('etag', false); // dynamic API — never 304 against a stale browser cache
app.use(express.json({ limit: '100kb' }));
// never let API responses be cached by the browser
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Lightweight rate limiter for expensive endpoints (yt-dlp spawns).
const rateWindows = new Map(); // ip -> { count, resetAt }
setInterval(() => {
  const now = Date.now();
  for (const [ip, w] of rateWindows) if (now > w.resetAt) rateWindows.delete(ip);
}, 60 * 1000).unref?.();
function rateLimit(max) {
  return (req, res, next) => {
    const ip = req.ip || 'local';
    const now = Date.now();
    const w = rateWindows.get(ip);
    if (!w || now > w.resetAt) {
      rateWindows.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    w.count += 1;
    if (w.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((w.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests — try again shortly.' });
    }
    next();
  };
}
app.use(['/api/import', '/api/chapters'], rateLimit(10));
app.use('/api/share', rateLimit(30));
// Expensive spawns / abuse-prone endpoints:
app.use(['/api/stream', '/api/addon/track'], rateLimit(30));
app.use(['/api/together/create', '/api/together/join'], rateLimit(10));
app.use('/api/health', rateLimit(30));

// ---------- API ----------

app.get('/api/health', async (_req, res) => {
  const ytDlp = await ytDlpAvailable();
  res.json({ ok: true, app: 'Chordless', ytDlp, node: process.version, time: Date.now() });
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  if (q.length > 200) return res.status(400).json({ error: 'Query too long' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 60);
  const locale = normalizeLocale(req.query.gl, req.query.hl);
  try {
    const results = await searchMusic(q, limit, locale);
    res.json({ results });
  } catch (e) {
    console.error('[search]', e.message);
    res.status(502).json({ error: 'YouTube Music search failed. Please try again.' });
  }
});

app.get('/api/home', async (req, res) => {
  const locale = normalizeLocale(req.query.gl, req.query.hl);
  try {
    const result = await homeShelves(locale.gl, locale.hl);
    res.json({ ...result, gl: locale.gl, hl: locale.hl });
  } catch (e) {
    console.error('[home]', e.message);
    res.status(502).json({ error: 'Failed to load home feed.' });
  }
});

app.get('/api/charts', async (req, res) => {
  const locale = normalizeLocale(req.query.gl, req.query.hl);
  try {
    const shelves = await getCharts(locale.gl, locale.hl);
    res.json({ shelves, gl: locale.gl, hl: locale.hl });
  } catch (e) {
    console.error('[charts]', e.message);
    res.status(502).json({ error: 'Failed to load charts.' });
  }
});

app.get('/api/playlist', async (req, res) => {
  const id = String(req.query.id || '');
  try {
    const playlist = await getPlaylist(id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    res.json(playlist);
  } catch (e) {
    console.error('[playlist]', e.message);
    res.status(502).json({ error: 'Failed to load playlist.' });
  }
});

app.get('/api/artist', async (req, res) => {
  const id = String(req.query.id || '');
  try {
    const artist = await getArtist(id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json(artist);
  } catch (e) {
    console.error('[artist]', e.message);
    res.status(502).json({ error: 'Failed to load artist.' });
  }
});

app.get('/api/album', async (req, res) => {
  const id = String(req.query.id || '');
  try {
    const album = await getAlbum(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    res.json(album);
  } catch (e) {
    console.error('[album]', e.message);
    res.status(502).json({ error: 'Failed to load album.' });
  }
});

app.get('/api/stream/:id', streamAudio);

app.get('/api/sponsorblock', async (req, res) => {
  const id = String(req.query.id || '');
  if (!isValidVideoId(id)) return res.status(400).json({ error: 'Invalid video id' });
  const raw = String(req.query.categories || '');
  const categories = raw ? raw.split(',').map((c) => c.trim()).filter(Boolean) : DEFAULT_CATEGORIES;
  try {
    res.json(await getSegments(id, categories));
  } catch (e) {
    console.error('[sponsorblock]', e.message);
    res.json({ found: false, segments: [], offline: true });
  }
});

app.get('/api/lyrics', async (req, res) => {
  const artist = String(req.query.artist || '').slice(0, 200);
  const track = String(req.query.track || '').slice(0, 200);
  const album = String(req.query.album || '').slice(0, 200) || undefined;
  const duration = Number(req.query.duration) || undefined;
  try {
    const lyrics = await getLyrics({ artist, track, album, duration });
    res.json(lyrics);
  } catch (e) {
    console.error('[lyrics]', e.message);
    res.status(502).json({ error: 'Lyrics lookup failed.' });
  }
});

app.post('/api/translate', async (req, res) => {
  const { text, target = 'id' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text' });
  }
  try {
    const result = await translateLyrics(text, target);
    res.json(result);
  } catch (e) {
    console.error('[translate]', e.message);
    res.status(502).json({ error: 'Translation failed.' });
  }
});

app.get('/api/cover', coverImage);

app.get('/api/chapters', async (req, res) => {
  const id = String(req.query.id || '');
  if (!isValidVideoId(id)) return res.status(400).json({ error: 'Invalid video id' });
  try {
    res.json({ chapters: await getChapters(id) });
  } catch (e) {
    console.error('[chapters]', e.message);
    res.json({ chapters: [] });
  }
});

// ---------- Shared playlist links ----------
app.post('/api/share', (req, res) => {
  const { name, tracks } = req.body || {};
  if (!Array.isArray(tracks) || !tracks.length) return res.status(400).json({ error: 'Missing tracks' });
  if (tracks.length > 200) return res.status(400).json({ error: 'Playlist too large (max 200 tracks)' });
  const created = createShare({ name, tracks });
  if (!created) return res.status(400).json({ error: 'Could not create share link' });
  res.json({ ...created, url: `${req.protocol}://${req.get('host')}/share/${created.id}` });
});

app.get('/api/share/:id', (req, res) => {
  const data = getShare(req.params.id);
  if (!data) return res.status(404).json({ error: 'Share link not found or expired (7 days).' });
  res.json(data);
});

// ---------- Import from link (YouTube / Deezer / Spotify → playable playlist) ----------
app.post('/api/import', async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Missing URL' });
  if (url.length > 500) return res.status(400).json({ error: 'URL too long' });
  const gl = String(req.body?.gl || '');
  const hl = String(req.body?.hl || '');
  try {
    const result = await importFromUrl(url, { gl, hl });
    res.json(result);
  } catch (e) {
    console.error('[import]', e.message);
    res.status(502).json({ error: e.message || 'Import failed.' });
  }
});

// ---------- Listen Together ----------
app.post('/api/together/create', (req, res) => {
  const name = String(req.body?.name || 'Host').trim().slice(0, 40) || 'Host';
  res.json(createRoom(name));
});
app.post('/api/together/join', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const name = String(req.body?.name || 'Guest').trim().slice(0, 40) || 'Guest';
  if (!code) return res.status(400).json({ error: 'Missing room code' });
  const result = joinRoom(code, name);
  if (!result) return res.status(404).json({ error: 'Room not found (check the code).' });
  if (result.error) return res.status(409).json({ error: result.error });
  res.json(result);
});
app.get('/api/together/:code/state', (req, res) => {
  const room = getRoom(req.params.code, req.query.memberId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});
app.post('/api/together/:code/state', (req, res) => {
  const room = pushState(req.params.code, req.body?.memberId, req.body?.state || {});
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});
app.post('/api/together/:code/chat', (req, res) => {
  const room = pushChat(req.params.code, req.body?.memberId, req.body?.text || '');
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});
app.post('/api/together/:code/presence', (req, res) => {
  const room = pushPresence(req.params.code, req.body?.memberId, req.body?.track || null);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});
app.post('/api/together/:code/leave', (req, res) => {
  const result = leaveRoom(req.params.code, req.body?.memberId);
  res.json(result);
});

// ---------- Lossless addon (BitChord-compatible) ----------

app.post('/api/addon/test', async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Missing addon URL' });
  try {
    const result = await testAddon(url);
    if (!result.ok) return res.status(502).json(result);
    res.json({ ok: true, manifest: result.manifest });
  } catch (e) {
    console.error('[addon/test]', e.message);
    res.status(502).json({ ok: false, error: 'Addon tidak bisa dijangkau.' });
  }
});

app.get('/api/addon/search', async (req, res) => {
  const base = String(req.query.base || '');
  const q = String(req.query.q || '').trim();
  const quality = String(req.query.quality || 'LOSSLESS');
  if (!base) return res.status(400).json({ error: 'Missing addon base URL' });
  if (q.length < 2) return res.json({ found: true, tracks: [] });
  try {
    res.json(await searchAddon(base, quality, q, 25));
  } catch (e) {
    console.error('[addon/search]', e.message);
    res.json({ found: false, tracks: [] });
  }
});

// Streams bytes from the addon's CDN through this server (Range supported) — keeps artwork disk-friendly,
// and lets the browser treat the stream as same-origin for the visualizer.
app.get('/api/addon/track', async (req, res) => {
  const base = String(req.query.base || '');
  const id = String(req.query.id || '').trim();
  const quality = String(req.query.quality || 'LOSSLESS');
  if (!base || !id) return res.status(400).json({ error: 'Missing addon base or track id' });
  const info = await resolveAddonStream(base, quality, id).catch((e) => {
    console.error('[addon/track] resolve failed:', e.message);
    return null;
  });
  if (!info || !info.url) {
    return res.status(502).json({ error: 'Addon could not resolve a playable stream for this track.' });
  }
  const headers = { 'User-Agent': 'Chordless/1.0 (music client)', Accept: '*/*', 'Accept-Encoding': 'identity' };
  if (req.headers.range) headers.Range = req.headers.range;
  let upstream;
  // IMPORTANT: do NOT use AbortSignal.timeout() here. That signal would abort
  // the response *body* 30s after headers arrive, cutting playback off at
  // exactly ~30 seconds. Instead, time out only until headers arrive, then
  // let the audio stream flow indefinitely.
  const controller = new AbortController();
  const connectTimeout = setTimeout(() => controller.abort(), 30000);
  try {
    upstream = await fetch(info.url, { headers, redirect: 'follow', signal: controller.signal });
    clearTimeout(connectTimeout);
  } catch (e) {
    clearTimeout(connectTimeout);
    console.error('[addon/track] upstream connect failed:', e.message);
    return res.status(502).json({ error: 'Failed to connect to the addon audio source' });
  }
  if (!upstream.ok && upstream.status !== 206) {
    console.error('[addon/track] upstream HTTP', upstream.status, 'for', id);
    return res.status(502).json({ error: `Addon audio source returned HTTP ${upstream.status}` });
  }
  res.setHeader('X-Addon-Quality', info.quality || quality);
  if (info.codec) res.setHeader('X-Addon-Codec', info.codec);
  if (info.sampleRate) res.setHeader('X-Addon-SampleRate', String(info.sampleRate));
  if (info.bitDepth) res.setHeader('X-Addon-BitDepth', String(info.bitDepth));
  return pipeUpstream(req, res, upstream, info.mimeType || 'audio/flac');
});

// ---------- Static frontend (production) ----------

if (isProd || fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      else res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    },
  }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
}

// ---------- Errors ----------

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`\n  Chordless server → http://${HOST}:${PORT}  (${isProd ? 'production' : 'development'})\n`);
});
