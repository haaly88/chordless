/**
 * Cover-image proxy — fetches remote artwork server-side so the client
 * can draw it to a <canvas> (for dynamic color extraction) without
 * cross-origin tainting. Host-whitelisted.
 */
import { createCache } from './cache.js';

const cache = createCache({ max: 400, ttlMs: 24 * 60 * 60 * 1000 });

const ALLOWED_HOSTS = new Set([
  'yt3.googleusercontent.com',
  'yt4.googleusercontent.com',
  'lh3.googleusercontent.com',
  'i.ytimg.com',
  'img.youtube.com',
]);

export async function coverImage(req, res) {
  const raw = String(req.query.url || '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return res.status(400).json({ error: 'Host not allowed' });
  }

  const cached = cache.get(`cover:${url.href}`);
  if (cached) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(cached.body);
  }

  try {
    const upstream = await fetch(url.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', Accept: '*/*', 'Accept-Encoding': 'identity' },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) return res.status(502).json({ error: `Cover fetch failed (HTTP ${upstream.status})` });
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(contentType)) {
      return res.status(502).json({ error: 'Cover is not an image' });
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'Cover too large' });
    cache.set(`cover:${url.href}`, { body: buf, contentType });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buf);
  } catch {
    res.status(502).json({ error: 'Cover fetch failed' });
  }
}
