/**
 * Shared playlists — in-memory link store (no auth, like Listen Together).
 * POST /api/share creates { id, url }; GET /api/share/:id returns the playlist.
 * Shares expire after 7 days. Single-process only (no Redis).
 */

const shares = new Map(); // id -> { name, tracks, createdAt }
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function genId() {
  return Math.random().toString(36).slice(2, 10).toLowerCase();
}

function prune() {
  const t = Date.now();
  for (const [id, s] of shares) {
    if (t - s.createdAt > TTL_MS) shares.delete(id);
  }
}

setInterval(prune, 60 * 60 * 1000).unref?.();

export function createShare(playlist) {
  const name = String(playlist?.name || 'Shared playlist').slice(0, 120);
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks.slice(0, 200) : [];
  if (!tracks.length) return null;
  let id = genId();
  while (shares.has(id)) id = genId();
  shares.set(id, { name, tracks, createdAt: Date.now() });
  return { id, name, tracks: tracks.length };
}

export function getShare(id) {
  const key = String(id || '').toLowerCase();
  const s = shares.get(key);
  if (!s) return null;
  if (Date.now() - s.createdAt > TTL_MS) {
    shares.delete(key);
    return null;
  }
  return { name: s.name, tracks: s.tracks, createdAt: s.createdAt };
}
