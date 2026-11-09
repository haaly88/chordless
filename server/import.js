/**
 * Import from link — turns a share URL into a playable Chordless playlist.
 *
 * Supported:
 *  - YouTube / YouTube Music playlist or video (via InnerTube, most reliable)
 *  - Deezer playlist / album / track (via public api.deezer.com → YouTube resolve)
 *  - Spotify track (oEmbed title → YouTube resolve) and playlist (yt-dlp flat dump → resolve)
 *
 * Returns normalized YouTube tracks (playable via /api/stream/:id).
 * Limit: first 50 entries; resolution is best-effort per entry.
 */
import { spawn } from 'node:child_process';
import { withYtDlpSlot } from './pool.js';
import { ytDlpCommand } from './ytdlp.js';
import { getPlaylist, searchMusic, normalizeLocale } from './innertube.js';

const MAX_TRACKS = 50;

/** Extract { provider, kind, id } from a user-pasted URL. */
export function parseImportUrl(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl || '').trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const path = u.pathname;

  // YouTube / YouTube Music / youtu.be
  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    const list = u.searchParams.get('list');
    const v = u.searchParams.get('v');
    if (host === 'youtu.be') {
      const id = path.replace(/^\//, '').split('/')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { provider: 'youtube', kind: 'video', id };
      return null;
    }
    if (list && /^[A-Za-z0-9_-]{8,64}$/.test(list)) return { provider: 'youtube', kind: 'playlist', id: list };
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
      // watch?v=ID&list=PL… → prefer playlist when both present
      return { provider: 'youtube', kind: 'video', id: v };
    }
    return null;
  }

  // Deezer
  if (host === 'deezer.com') {
    const m = path.match(/\/(?:[a-z]{2}\/)?(playlist|album|track)\/(\d+)/i);
    if (m) return { provider: 'deezer', kind: m[1].toLowerCase(), id: m[2] };
    return null;
  }

  // Spotify
  if (host === 'open.spotify.com') {
    const m = path.match(/\/(playlist|track|album)\/([A-Za-z0-9]+)/i);
    if (m) return { provider: 'spotify', kind: m[1].toLowerCase(), id: m[2] };
    return null;
  }

  return null;
}

/** Resolve one "Title — Artist" to the best YouTube track, or null. */
async function resolveOnYouTube(title, artist, locale) {
  const q = `${title} ${artist || ''}`.trim().slice(0, 160);
  if (!q) return null;
  const results = await searchMusic(q, 5, locale);
  const hit = (results || []).find((t) => t?.id && t.kind !== 'artist' && t.kind !== 'album') || (results || [])[0];
  if (!hit?.id) return null;
  return hit;
}

/** YouTube playlist via InnerTube. */
async function importYouTubePlaylist(id, locale) {
  const playlist = await getPlaylist(id);
  if (!playlist) throw new Error('YouTube playlist not found (private or invalid link?).');
  const tracks = (playlist.tracks || [])
    .filter((t) => t?.id && t.kind !== 'artist' && t.kind !== 'album')
    .slice(0, MAX_TRACKS);
  return { title: playlist.title || 'Imported playlist', source: 'YouTube', tracks };
}

/** YouTube single video via oEmbed metadata (playable by id). */
async function importYouTubeVideo(id) {
  let title = 'Single track';
  let artist = '';
  let thumbnail = '';
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
      headers: { 'User-Agent': 'Chordless/1.0 (music client)' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      title = data.title || title;
      artist = data.author_name || '';
      thumbnail = data.thumbnail_url || '';
    }
  } catch { /* metadata is best-effort; id alone plays */ }
  return {
    title,
    source: 'YouTube',
    tracks: [{ id, title, artist, album: '', duration: 0, thumbnail, kind: 'song' }],
  };
}

/** Deezer playlist/album/track via public API → YouTube resolve. */
async function importDeezer(kind, id, locale) {
  const res = await fetch(`https://api.deezer.com/${kind}/${id}`, {
    headers: { 'User-Agent': 'Chordless/1.0 (music client)', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Deezer item not found (private or invalid link?).');
  const data = await res.json();
  if (data?.error) throw new Error(data.error.message || 'Deezer lookup failed.');

  let entries = [];
  let title = 'Deezer playlist';
  if (kind === 'track') {
    title = data.title || title;
    entries = [data];
  } else {
    title = data.title || title;
    entries = data.tracks?.data || [];
  }
  entries = entries.slice(0, MAX_TRACKS);

  const tracks = [];
  for (const e of entries) {
    const t = await resolveOnYouTube(e.title || '', e.artist?.name || '', locale).catch(() => null);
    if (t) tracks.push(t);
  }
  return { title, source: 'Deezer', tracks };
}

/** Spotify track via oEmbed → YouTube resolve. */
async function importSpotifyTrack(id, locale) {
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`, {
    headers: { 'User-Agent': 'Chordless/1.0 (music client)', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Spotify track not found.');
  const data = await res.json();
  const title = data.title || 'Spotify track';
  const artist = data.author_name || '';
  const hit = await resolveOnYouTube(title, artist, locale);
  return { title, source: 'Spotify', tracks: hit ? [hit] : [] };
}

/** Dump a Spotify playlist via yt-dlp flat playlist → resolve each on YouTube. */
function ytDlpFlatPlaylist(url) {
  return withYtDlpSlot(() => new Promise((resolve, reject) => {
    const { cmd, prefix } = ytDlpCommand();
    const args = [
      ...prefix, '--no-warnings', '--flat-playlist',
      '--print', '%(title)s ||| %(uploader)s',
      '--max-downloads', '0', url,
    ];
    const child = spawn(cmd, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Spotify playlist timed out.')); }, 45000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.slice(-300) || 'yt-dlp failed for this Spotify link.'));
      resolve(out);
    });
  }));
}

async function importSpotifyPlaylist(id, locale) {
  // Playlist title via oEmbed (best-effort)
  let title = 'Spotify playlist';
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/playlist/${id}`)}`, {
      headers: { 'User-Agent': 'Chordless/1.0 (music client)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      title = data.title || title;
    }
  } catch { /* keep default */ }

  const dumped = await ytDlpFlatPlaylist(`https://open.spotify.com/playlist/${id}`);
  const entries = dumped.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, MAX_TRACKS);
  if (!entries.length) throw new Error('No tracks found in this Spotify playlist (may be private).');
  const tracks = [];
  for (const line of entries) {
    const [t, a] = line.split(' ||| ').map((s) => (s || '').trim());
    const hit = await resolveOnYouTube(t || '', a || '', locale).catch(() => null);
    if (hit) tracks.push(hit);
  }
  return { title, source: 'Spotify', tracks };
}

async function importSpotifyAlbum(id, locale) {
  // Albums via yt-dlp flat dump like playlists
  const dumped = await ytDlpFlatPlaylist(`https://open.spotify.com/album/${id}`);
  const entries = dumped.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, MAX_TRACKS);
  if (!entries.length) throw new Error('No tracks found in this Spotify album.');
  const tracks = [];
  for (const line of entries) {
    const [t, a] = line.split(' ||| ').map((s) => (s || '').trim());
    const hit = await resolveOnYouTube(t || '', a || '', locale).catch(() => null);
    if (hit) tracks.push(hit);
  }
  return { title: 'Spotify album', source: 'Spotify', tracks };
}

/** Main entry: `url` → { title, source, tracks }. */
export async function importFromUrl(rawUrl, { gl, hl } = {}) {
  const parsed = parseImportUrl(rawUrl);
  if (!parsed) {
    throw new Error('Unsupported link. Paste a YouTube Music, Deezer, or Spotify playlist/track link.');
  }
  const locale = normalizeLocale(gl, hl);

  if (parsed.provider === 'youtube') {
    if (parsed.kind === 'playlist') {
      const out = await importYouTubePlaylist(parsed.id, locale);
      if (!out.tracks.length) throw new Error('No playable tracks found in this YouTube playlist.');
      return out;
    }
    return importYouTubeVideo(parsed.id);
  }
  if (parsed.provider === 'deezer') {
    const out = await importDeezer(parsed.kind, parsed.id, locale);
    if (!out.tracks.length) throw new Error('Could not match these Deezer tracks on YouTube.');
    return out;
  }
  if (parsed.provider === 'spotify') {
    if (parsed.kind === 'track') return importSpotifyTrack(parsed.id, locale);
    if (parsed.kind === 'playlist') {
      const out = await importSpotifyPlaylist(parsed.id, locale);
      if (!out.tracks.length) throw new Error('Could not match these Spotify tracks on YouTube. Try a YouTube link instead.');
      return out;
    }
    const out = await importSpotifyAlbum(parsed.id, locale);
    if (!out.tracks.length) throw new Error('Could not match these Spotify tracks on YouTube.');
    return out;
  }
  throw new Error('Unsupported link.');
}
