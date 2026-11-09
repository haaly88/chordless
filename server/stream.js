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
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { createCache } from './cache.js';
import { withYtDlpSlot } from './pool.js';
import { ytDlpCommand } from './ytdlp.js';

const urlCache = createCache({ max: 300, ttlMs: 4 * 60 * 60 * 1000 });
const failCache = createCache({ max: 300, ttlMs: 45 * 1000 });
const inflight = new Map();

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Encoding': 'identity',
};

const PLAYER_CLIENTS = ['tv_embedded', 'web_safari', 'ios'];
const CLIENT_PREFS = new Set(['auto', ...PLAYER_CLIENTS, 'default']);

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

function formatForQuality(quality) {
  return FORMAT_BY_QUALITY[String(quality || 'high').toLowerCase()] || FORMAT_BY_QUALITY.high;
}

function runYtDlpOnce(id, playerClient, quality) {
  const format = formatForQuality(quality);
  return new Promise((resolve, reject) => {
    const { cmd, prefix } = ytDlpCommand();
    const args = [
      ...prefix,
      '--js-runtimes', 'node',
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
    }, 60000);
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

/** Check that a googlevideo URL actually serves bytes (not 403). */
async function verifyAudioUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Range: 'bytes=0-0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    try { await res.arrayBuffer(); } catch { /* drained */ }
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

export async function resolveStream(id, pref = 'auto', quality = 'high') {
  const normalizedQuality = ['high', 'medium', 'low'].includes(String(quality || 'high').toLowerCase()) ? String(quality).toLowerCase() : 'high';
  const cacheKey = `stream:${pref}:${normalizedQuality}:${id}`;
  const cached = urlCache.get(cacheKey);
  if (cached) return cached;
  const failed = failCache.get(cacheKey);
  if (failed) throw new Error(failed);

  const flightKey = cacheKey;
  if (inflight.has(flightKey)) return inflight.get(flightKey);

  const p = (async () => {
    let lastError = null;
    for (const client of clientOrder(pref)) {
      try {
        const info = await runYtDlp(id, client, normalizedQuality);
        if (client === 'default') {
          // default client historically 403s; verify before trusting it
          if (!(await verifyAudioUrl(info.url))) {
            throw new Error('default client returned a URL YouTube refused (403)');
          }
        } else if (!(await verifyAudioUrl(info.url))) {
          console.warn('[stream] %s URL rejected for %s, trying next client', client, id);
          throw new Error(`${client} returned a URL YouTube refused (403)`);
        }
        urlCache.set(cacheKey, info);
        return info;
      } catch (e) {
        console.warn('[stream] %s failed for %s: %s', client, id, e.message);
        lastError = e;
      }
    }
    const message = lastError?.message || 'Could not resolve a playable stream';
    failCache.set(cacheKey, message);
    throw lastError || new Error(message);
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

  let info;
  try {
    info = await resolveStream(id, client, qualityParam);
  } catch (e) {
    console.error('[stream] resolve failed for', id, '—', e.message);
    return res.status(502).json({ error: e.message || 'Failed to resolve stream' });
  }

  // Warm-up mode: resolve only (kept for API compatibility; not used by the UI)
  if (req.query.warm === '1') return res.status(204).end();

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

  let upstream = await tryFetch(info);

  // Cached URL refused — drop it and re-resolve once
  if (!upstream || upstream.error || (upstream.status !== 206 && (upstream.status === 403 || upstream.status === 404 || upstream.status === 410))) {
    console.warn('[stream] cached URL refused for', id, '— re-resolving');
    // Evict every real key variant (pref × quality) — the previous
    // `stream:pref:id` guess never matched, so stale URLs lived 4h.
    for (const p of CLIENT_PREFS) {
      for (const q of ['high', 'medium', 'low']) urlCache.delete(`stream:${p}:${q}:${id}`);
    }
    try {
      info = await resolveStream(id, client, qualityParam);
      upstream = await tryFetch(info);
    } catch (e) {
      console.error('[stream] re-resolve failed for', id, '—', e.message);
      return res.status(502).json({ error: e.message || 'Failed to re-resolve stream' });
    }
  }

  if (!upstream || upstream.error) {
    console.error('[stream] upstream connect failed for', id, '—', upstream?.error?.message);
    return res.status(502).json({ error: 'Failed to connect to the audio source' });
  }

  if (!upstream.ok && upstream.status !== 206) {
    const body = await upstream.text().catch(() => '');
    console.error('[stream] upstream HTTP', upstream.status, 'for', id, '—', body.slice(0, 200));
    return res.status(502).json({ error: `Audio source returned HTTP ${upstream.status}` });
  }

  return pipeUpstream(req, res, upstream, EXT_CONTENT_TYPE[info.ext] || upstream.headers.get('content-type') || 'application/octet-stream');
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

export async function ytDlpAvailable() {
  return new Promise((resolve) => {
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
  });
}
