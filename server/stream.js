/**
 * Resolves direct audio stream URLs for a YouTube video id via yt-dlp
 * (handles the signature cipher + n-parameter challenge with the system
 * Node runtime), then proxies the bytes to the browser — including HTTP
 * Range support, which enables seeking and the Web Audio visualizer.
 *
 * YouTube throttles/403s aggressively per-IP and rolls out proof-of-origin
 * requirements, so resolution tries several embedded clients in order
 * (tv_embedded → web_safari → ios → default) and verifies the URL with a
 * 1-byte request before using it. Failures are cached for 45s to avoid
 * hammering YouTube when a video is genuinely unavailable.
 */
import { spawn, spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { createCache } from './cache.js';
import { withYtDlpSlot } from './pool.js';
import { ytDlpCommand } from './ytdlp.js';

const urlCache = createCache({ max: 300, ttlMs: 30 * 60 * 1000 });
const failCache = createCache({ max: 300, ttlMs: 30 * 1000 });
const inflight = new Map();

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Encoding': 'identity',
};

/**
 * Player clients that still serve the media.
 *
 * `web_embedded` is deliberately NOT used: it only exposes a ~48 KB preview
 * clip, never the full track. `tv_embedded` / `tv` answer with 403.
 */
const PLAYER_CLIENTS = ['android_vr', 'android', 'mweb', 'android_music', 'ios_music'];
const CLIENT_PREFS = new Set(['auto', ...PLAYER_CLIENTS, 'default']);

/**
 * Every client needs the muxed (video + audio) rendition: YouTube rejects
 * audio-only URLs without a proof-of-origin token.
 */
const MUXED_ONLY_CLIENTS = new Set(PLAYER_CLIENTS);

/** A real track is bigger than this; smaller answers are preview clips. */
const MIN_PLAUSIBLE_BYTES = 100 * 1024;

const EXT_CONTENT_TYPE = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  webm: 'audio/webm',
  opus: 'audio/ogg; codecs=opus',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
};

export const isValidVideoId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id);

function clientOrder(pref) {
  if (!pref || pref === 'auto') return [...PLAYER_CLIENTS];
  if (pref === 'default') return ['default', ...PLAYER_CLIENTS];
  if (PLAYER_CLIENTS.includes(pref)) return [pref, ...PLAYER_CLIENTS.filter((c) => c !== pref)];
  return [...PLAYER_CLIENTS];
}

const FORMAT_BY_QUALITY = {
  high: 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
  medium: 'bestaudio[abr<=160]/bestaudio',
  low: 'bestaudio[abr<=96]/worstaudio',
};

function formatForQuality(quality, playerClient) {
  if (MUXED_ONLY_CLIENTS.has(playerClient)) {
    // Smallest muxed rendition that still carries the audio (itag 18 style).
    return 'worst[ext=mp4][acodec!=none]/b[ext=mp4][acodec!=none]/b';
  }
  return FORMAT_BY_QUALITY[String(quality || 'high').toLowerCase()] || FORMAT_BY_QUALITY.high;
}

/**
 * Is a `node` binary reachable?
 *
 * yt-dlp only needs a JavaScript runtime for the clients that still require
 * the n-challenge; the ones we use work without it. Asking for a runtime that
 * is not installed makes yt-dlp abort, so the flag is only passed when node
 * is actually on PATH (a plain user has no Node installed).
 */
let nodeRuntimeAvailable = null;
function hasNodeRuntime() {
  if (nodeRuntimeAvailable !== null) return nodeRuntimeAvailable;
  try {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['node'], { stdio: 'ignore' });
    nodeRuntimeAvailable = probe.status === 0;
  } catch {
    nodeRuntimeAvailable = false;
  }
  return nodeRuntimeAvailable;
}

function runYtDlpOnce(id, playerClient, quality) {
  const format = formatForQuality(quality, playerClient);
  return new Promise((resolve, reject) => {
    const { cmd, prefix } = ytDlpCommand();
    const args = [
      ...prefix,
      ...(hasNodeRuntime() ? ['--js-runtimes', 'node'] : []),
      '--no-playlist',
      '--no-warnings',
      ...(playerClient && playerClient !== 'default' ? ['--extractor-args', `youtube:player_client=${playerClient}`] : []),
      '-f', format,
      '--print', '%(ext)s',
      '--print', '%(url)s',
      `https://www.youtube.com/watch?v=${id}`,
    ];
    const child = spawn(cmd, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('yt-dlp timed out while resolving the stream'));
    }, 25000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (code !== 0 || lines.length < 2) {
        reject(new Error(`yt-dlp failed (code ${code}): ${err.split('\n').filter(Boolean).pop() || 'no output'}`));
        return;
      }
      const ext = lines[lines.length - 2].toLowerCase();
      const url = lines[lines.length - 1];
      resolve({ ext, url, client: playerClient || 'default' });
    });
  });
}

function runYtDlp(id, playerClient, quality) {
  // Global pool: at most 4 concurrent yt-dlp processes machine-wide.
  return withYtDlpSlot(() => runYtDlpOnce(id, playerClient, quality));
}

/**
 * Warm-ups are serialised.
 *
 * A burst of background resolutions would compete with the request that
 * actually plays a track for the yt-dlp process pool — that is what made
 * "next" wait for tens of seconds.
 */
let warmChain = Promise.resolve();
function enqueueWarm(task) {
  const next = warmChain.then(task, task);
  warmChain = next.then(() => {}, () => {});
  return next;
}

/**
 * Check that a candidate actually serves the track (not 403, not a preview).
 *
 * Used by the warm-up route only: the real playback request is the one that
 * matters, and a second request per play made YouTube start refusing URLs.
 */
async function verifyCandidate(candidate) {
  try {
    const res = await fetch(candidate.url, {
      headers: { ...BROWSER_HEADERS, Range: 'bytes=0-0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    try { await res.arrayBuffer(); } catch { /* drained */ }
    if (!(res.ok || res.status === 206)) return false;
    const range = res.headers.get('content-range') || '';
    const total = Number(range.split('/')[1] || 0);
    return !total || total >= MIN_PLAUSIBLE_BYTES;
  } catch {
    return false;
  }
}

/**
 * Resolve the playable candidates for a video id.
 *
 * Resolution itself never touches googlevideo: verifying a candidate with a
 * separate request doubles the traffic per play and YouTube starts answering
 * with 403 (rate limiting) — which showed up as multi-second stalls. The
 * real fetch is the verification; a refused candidate just moves on to the
 * next one.
 */
/**
 * Resolve one playable candidate.
 *
 * The clients are raced in small groups (two at a time): the first that
 * resolves wins, while the yt-dlp process pool stays free for the request
 * that actually plays the track. Racing every client at once used to clog
 * the pool and delayed the real playback by tens of seconds.
 */
async function resolveCandidate(id, pref, quality, skipClients = new Set()) {
  const clients = clientOrder(pref).filter((c) => !skipClients.has(c));
  for (let i = 0; i < clients.length; i += 2) {
    const group = clients.slice(i, i + 2);
    const attempts = group.map((client) =>
      runYtDlp(id, client, quality).then((info) => ({ ...info, client })),
    );
    try {
      return await Promise.any(attempts);
    } catch {
      /* try the next group */
    }
  }
  try {
    const { resolveWithYoutubei } = await import('./streamFallback.js');
    const info = await resolveWithYoutubei(id, quality);
    if (info?.url) return { ...info, client: 'youtubei' };
  } catch {
    /* no fallback available */
  }
  throw new Error('Could not resolve a playable stream');
}

/** Resolve the best candidate and remember it (used by the warm-up route). */
export async function resolveStream(id, pref = 'auto', quality = 'high', { verify = false } = {}) {
  const normalizedQuality = ['high', 'medium', 'low'].includes(String(quality || 'high').toLowerCase()) ? String(quality).toLowerCase() : 'high';
  const cacheKey = `stream:${pref}:${normalizedQuality}:${id}`;
  const cached = urlCache.get(cacheKey);
  if (cached && !verify) return cached;
  const failed = failCache.get(cacheKey);
  if (failed) throw new Error(failed);

  const flightKey = cacheKey;
  if (inflight.has(flightKey)) return inflight.get(flightKey);

  const p = (async () => {
    const skipClients = new Set();
    for (;;) {
      let candidate;
      try {
        candidate = await resolveCandidate(id, pref, normalizedQuality, skipClients);
      } catch {
        break;
      }
      if (verify) {
        // The warm-up may spend one request to be sure the URL we remember
        // is one YouTube will actually serve.
        const ok = await verifyCandidate(candidate);
        if (!ok) {
          skipClients.add(candidate.client);
          continue;
        }
      }
      urlCache.set(cacheKey, candidate);
      return candidate;
    }
    const message = 'Could not resolve a playable stream';
    failCache.set(cacheKey, message);
    throw new Error(message);
  })().finally(() => inflight.delete(flightKey));
  inflight.set(flightKey, p);
  return p;
}

export async function streamAudio(req, res) {
  const { id } = req.params;
  if (!isValidVideoId(id)) return res.status(400).json({ error: 'Invalid video id' });

  const clientParam = String(req.query.client || 'auto').toLowerCase();
  const client = CLIENT_PREFS.has(clientParam) ? clientParam : 'auto';
  const qualityParam = ['high', 'medium', 'low'].includes(String(req.query.quality || 'high').toLowerCase()) ? String(req.query.quality).toLowerCase() : 'high';

  const cacheKey = `stream:${client}:${qualityParam}:${id}`;
  const headers = { ...BROWSER_HEADERS };
  if (req.headers.range) headers.Range = req.headers.range;

  const tryFetch = async (target) => {
    // Timeout applies ONLY until response headers arrive. Using
    // AbortSignal.timeout() here would abort the audio body 30s into
    // playback, cutting every track off at ~30 seconds.
    const controller = new AbortController();
    const connectTimeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(target.url, { headers, redirect: 'follow', signal: controller.signal });
      clearTimeout(connectTimeout);
      return res;
    } catch (e) {
      clearTimeout(connectTimeout);
      return { error: e };
    }
  };

  // Warm-up mode: resolve AND verify the URL, so the play request that
  // follows is served from the cache with a URL YouTube accepts.
  if (req.query.warm === '1') {
    try {
      // Resolve AND verify: the verification request warms the media CDN edge
      // for this URL, which is what makes the real playback request start
      // within a few hundred milliseconds instead of several seconds.
      const info = await enqueueWarm(() =>
        resolveStream(id, client, qualityParam, { verify: true }),
      );
      urlCache.set(cacheKey, info);
      return res.status(204).end();
    } catch (e) {
      console.error('[stream] warm failed for', id, '—', e.message);
      return res.status(502).json({ error: e.message || 'Failed to resolve stream' });
    }
  }

  // Playback: try the remembered candidate first, then resolve further
  // candidates until one actually serves bytes. A refused URL (403) is
  // normal — signed media URLs expire or get throttled — so we simply move
  // on to the next candidate instead of failing the track.
  const cached = urlCache.get(cacheKey);
  const skipClients = new Set();
  let lastStatus = 0;
  let candidate = cached || null;

  for (;;) {
    if (!candidate) {
      try {
        candidate = await resolveCandidate(id, client, qualityParam, skipClients);
      } catch (e) {
        console.error('[stream] resolve failed for', id, '—', e.message);
        return res.status(502).json({ error: e.message || 'Failed to resolve stream' });
      }
    }
    const upstream = await tryFetch(candidate);
    if (upstream && !upstream.error && (upstream.ok || upstream.status === 206)) {
      urlCache.set(cacheKey, candidate);
      return pipeUpstream(
        req,
        res,
        upstream,
        EXT_CONTENT_TYPE[candidate.ext] || upstream.headers.get('content-type') || 'application/octet-stream',
      );
    }
    if (upstream && !upstream.error) {
      lastStatus = upstream.status;
      console.warn('[stream] %s refused (%s) for %s — trying the next candidate', candidate.client, upstream.status, id);
    } else {
      console.warn('[stream] %s failed (%s) for %s — trying the next candidate', candidate.client, upstream?.error?.message, id);
    }
    skipClients.add(candidate.client);
    candidate = null;
    if (skipClients.size >= CLIENT_PREFS.size + 1) break;
  }

  console.error('[stream] no candidate served bytes for', id);
  return res.status(502).json({
    error: lastStatus ? `Audio source returned HTTP ${lastStatus}` : 'Could not play this track',
  });
}

/** Pipe an already-resolved upstream fetch response to the client, with Range support. */
export function pipeUpstream(req, res, upstream, contentType) {
  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');
  for (const h of ['content-length', 'content-range']) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }

  if (!upstream.body) return res.end();
  const nodeStream = Readable.fromWeb(upstream.body);
  nodeStream.on('error', () => { if (!res.headersSent) res.status(502); res.end(); });
  req?.on('close', () => nodeStream.destroy());
  nodeStream.pipe(res);
}

let ytDlpCache = null; // { value, at }
let ytDlpInflight = null;
const YTDLP_TTL_MS = 30 * 1000;
export async function ytDlpAvailable() {
  const now = Date.now();
  if (ytDlpCache && now - ytDlpCache.at < YTDLP_TTL_MS) return ytDlpCache.value;
  if (ytDlpInflight) return ytDlpInflight;
  const p = new Promise((resolve) => {
    const { cmd, prefix } = ytDlpCommand();
    const child = spawn(cmd, [...prefix, '--version'], { windowsHide: true });
    let out = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(null);
    }, 10000);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 ? out.trim() : null); });
  }).then((value) => {
    ytDlpCache = { value, at: Date.now() };
    ytDlpInflight = null;
    return value;
  });
  ytDlpInflight = p;
  return p;
}
