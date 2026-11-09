/**
 * YouTube chapters via yt-dlp — returns [{ start, end, title }].
 * Cached 6h per video id. Empty array when the video has no chapters.
 */
import { spawn } from 'node:child_process';
import { createCache } from './cache.js';
import { isValidVideoId } from './stream.js';
import { withYtDlpSlot } from './pool.js';
import { ytDlpCommand } from './ytdlp.js';

const cache = createCache({ max: 200, ttlMs: 6 * 60 * 60 * 1000 });
const inflight = new Map(); // id -> Promise (dedup concurrent spawns)

function fetchChaptersOnce(id) {
  return withYtDlpSlot(() => new Promise((resolve, reject) => {
    const { cmd, prefix } = ytDlpCommand();
    const args = [
      ...prefix,
      '--js-runtimes', 'node',
      '--no-playlist',
      '--no-warnings',
      '--print', '%(chapters)j',
      `https://www.youtube.com/watch?v=${id}`,
    ];
    const child = spawn(cmd, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Chapters lookup timed out')); }, 30000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.split('\n').filter(Boolean).pop() || 'yt-dlp failed'));
      try {
        const raw = JSON.parse(out.trim());
        const list = Array.isArray(raw) ? raw : [];
        const chapters = list
          .map((c) => ({
            start: Math.max(0, Number(c.start_time) || 0),
            end: Math.max(0, Number(c.end_time) || 0),
            title: String(c.title || 'Chapter').slice(0, 120),
          }))
          .filter((c) => Number.isFinite(c.start))
          .sort((a, b) => a.start - b.start)
          .slice(0, 50);
        cache.set(id, chapters);
        resolve(chapters);
      } catch {
        resolve([]);
      }
    });
  }));
}

export async function getChapters(id) {
  if (!isValidVideoId(id)) return [];
  const cached = cache.get(id);
  if (cached) return cached;
  if (inflight.has(id)) return inflight.get(id);
  const p = fetchChaptersOnce(id).catch(() => {
    cache.set(id, []);
    return [];
  }).finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}
