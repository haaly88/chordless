/**
 * For You AI Mix — pure taste engine.
 * Scores your library by playCount, likes, recency and artist affinity,
 * then interleaves artists so the mix doesn't clump. No network — the
 * store enriches it with fresh YouTube picks.
 */

const MAX = (n) => Math.max(1, Math.floor(n) || 1);

function daySeed(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic shuffle by seed string (so the mix is stable within a day, varies next day). */
export function seededShuffle(list, seed) {
  const arr = list.slice();
  let s = hashStr(String(seed || 'foryou'));
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function artistAffinity(history, liked) {
  const aff = new Map();
  const bump = (artist, val) => {
    const key = String(artist || 'Unknown artist').trim().toLowerCase();
    if (!key) return;
    aff.set(key, (aff.get(key) || 0) + val);
  };
  for (const t of history || []) bump(t.artist, 1 + (t.playCount || 1) / 2);
  for (const t of liked || []) bump(t.artist, 2);
  return [...aff.entries()]
    .map(([key, score]) => ({ key, label: key, score }))
    .sort((a, b) => b.score - a.score);
}

function recencyBoost(playedAt, now) {
  if (!playedAt) return 0;
  const ageH = Math.max(0, (now - playedAt) / 3600000);
  return Math.exp(-ageH / 72) * 4; // ~recent week matters
}

function scoreTrack(track, ctx) {
  const { likedSet, artistScores, playlistCounts } = ctx;
  let score = 0;
  score += (track.playCount || 1) * 2;
  if (likedSet.has(track.id)) score += 5;
  score += playlistCounts.get(track.id) || 0;
  score += recencyBoost(track.playedAt, ctx.now);
  const key = String(track.artist || '').trim().toLowerCase();
  const aff = artistScores.get(key) || 0;
  score += Math.min(3, aff / 4);
  return score;
}

/** Interleave by artist so the same artist rarely plays back-to-back. */
function interleaveByArtist(scored) {
  const buckets = new Map();
  for (const t of scored) {
    const key = String(t.artist || 'Unknown artist').trim().toLowerCase();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }
  // Highest first inside each bucket; buckets ordered by their head score.
  const groups = [...buckets.values()].map((g) => g.sort((a, b) => b._score - a._score));
  const out = [];
  while (groups.some((g) => g.length)) {
    groups.sort((a, b) => (b[0] ? b[0]._score : -Infinity) - (a[0] ? a[0]._score : -Infinity));
    for (const g of groups) if (g.length) out.push(g.shift());
  }
  return out;
}

export function buildForYouMix({ history = [], liked = [], playlists = [], limit = 20, now = Date.now(), date = new Date() } = {}) {
  const lim = MAX(limit);
  const likedSet = new Set((liked || []).map((t) => t.id));
  const playlistCounts = new Map();
  for (const pl of playlists || []) {
    for (const t of pl.tracks || []) playlistCounts.set(t.id, (playlistCounts.get(t.id) || 0) + 1);
  }

  // Merge history + liked + playlist tracks into a pool keyed by id.
  const pool = new Map();
  const merge = (t, extra = {}) => {
    if (!t?.id) return;
    const prev = pool.get(t.id) || { ...t, playCount: 0, playedAt: 0 };
    pool.set(t.id, {
      ...prev,
      ...t,
      playCount: Math.max(prev.playCount || 0, t.playCount || 0),
      playedAt: Math.max(prev.playedAt || 0, t.playedAt || 0),
      ...extra,
    });
  };
  for (const t of history || []) merge(t);
  for (const t of liked || []) merge(t);
  // Playlist tracks only join if the user already knows them (history/liked);
  // otherwise the pool stays personal, not "everything you saved".
  const scored = [...pool.values()]
    .map((t) => ({ ...t, _score: scoreTrack(t, {
      likedSet,
      playlistCounts,
      artistScores: new Map(artistAffinity(history, liked).map((a) => [a.key, a.score])),
      now,
    }) }))
    .sort((a, b) => b._score - a._score);

  const interleaved = interleaveByArtist(scored).slice(0, lim);
  const tracks = interleaved.map(({ _score, ...rest }) => rest);

  const affinity = artistAffinity(history, liked);
  const topArtists = affinity.slice(0, 5).map((a) => {
    const orig = (history.find((t) => String(t.artist || '').toLowerCase() === a.key)?.artist)
      || (liked.find((t) => String(t.artist || '').toLowerCase() === a.key)?.artist)
      || a.label;
    return orig;
  });

  const totalPlays = (history || []).reduce((s, t) => s + (t.playCount || 1), 0);
  const stats = {
    historyCount: (history || []).length,
    likedCount: (liked || []).length,
    totalPlays,
    poolSize: pool.size,
  };

  const reason = topArtists.length
    ? `Based on ${topArtists.slice(0, 3).join(', ')}${topArtists.length > 3 ? ' +' : ''}`
    : totalPlays > 0 ? 'Based on your recent plays' : 'Start listening to build your mix';

  return { tracks, topArtists, reason, stats, seed: daySeed(date) };
}
