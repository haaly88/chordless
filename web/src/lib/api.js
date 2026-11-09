/** Thin API client for the Chordless backend. */

/** Backend base URL. Empty = same origin (desktop/web). On Android (and any
 * setup without the server on the same origin) the user points this at a
 * public Chordless server (e.g. one deployed from Settings → General →
 * Server URL), persisted in localStorage cl:settings.serverUrl. */
export function apiBase() {
  try {
    const s = JSON.parse(localStorage.getItem('cl:settings') || '{}');
    return String(s.serverUrl || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Standalone mode: no backend configured AND the native InnerTube bridge
 * is present (Android APK). Catalog requests then go through ytclient.js. */
async function standalone() {
  if (apiBase()) return false;
  const { standaloneAvailable } = await import('./ytclient.js');
  return standaloneAvailable();
}

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function apiHealth() {
  // Standalone native mode has no backend — report healthy so callers
  // don't flash a spurious "Backend offline" toast.
  if (await standalone()) return { ok: true, app: 'Chordless', ytDlp: false, node: 'native', time: Date.now() };
  return json(await fetch(`${apiBase()}/api/health`));
}

export async function apiSearch(query, { signal, limit = 40, gl, hl } = {}) {
  if (await standalone()) {
    const { searchMusic } = await import('./ytclient.js');
    return { results: await searchMusic(query, limit, { gl, hl }) };
  }
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  return json(await fetch(`${apiBase()}/api/search?${params}`, { signal }));
}

export async function apiHome({ signal, gl, hl } = {}) {
  if (await standalone()) {
    const { homeShelves } = await import('./ytclient.js');
    return homeShelves(gl, hl);
  }
  const params = new URLSearchParams();
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  const qs = params.toString() ? `?${params}` : '';
  return json(await fetch(`${apiBase()}/api/home${qs}`, { signal }));
}

export async function apiCharts({ signal, gl, hl } = {}) {
  if (await standalone()) {
    const { getCharts } = await import('./ytclient.js');
    return getCharts(gl, hl);
  }
  const params = new URLSearchParams();
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  const qs = params.toString() ? `?${params}` : '';
  return json(await fetch(`${apiBase()}/api/charts${qs}`, { signal }));
}

export async function apiPlaylist(id, { signal } = {}) {
  if (await standalone()) {
    const { getPlaylist } = await import('./ytclient.js');
    return getPlaylist(id);
  }
  const params = new URLSearchParams({ id });
  return json(await fetch(`${apiBase()}/api/playlist?${params}`, { signal }));
}

export async function apiArtist(id, { signal } = {}) {
  if (await standalone()) {
    const { getArtist } = await import('./ytclient.js');
    return getArtist(id);
  }
  const params = new URLSearchParams({ id });
  return json(await fetch(`${apiBase()}/api/artist?${params}`, { signal }));
}

export async function apiAlbum(id, { signal } = {}) {
  if (await standalone()) {
    const { getAlbum } = await import('./ytclient.js');
    return getAlbum(id);
  }
  const params = new URLSearchParams({ id });
  return json(await fetch(`${apiBase()}/api/album?${params}`, { signal }));
}

export async function apiLyrics({ artist, track, album, duration }, { signal } = {}) {
  if (await standalone()) {
    // LRCLIB is CORS-enabled — query it directly in standalone mode.
    const params = new URLSearchParams({ artist_name: artist || '', track_name: track || '' });
    if (album) params.set('album_name', album);
    if (duration) params.set('duration', String(Math.round(duration)));
    const res = await fetch(`https://lrclib.net/api/get?${params}`, { signal });
    if (!res.ok) throw new Error('no lyrics');
    const data = await res.json().catch(() => ({}));
    return { syncedLyrics: data.syncedLyrics || '', plainLyrics: data.plainLyrics || '' };
  }
  const params = new URLSearchParams({ artist: artist || '', track: track || '' });
  if (album) params.set('album', album);
  if (duration) params.set('duration', String(Math.round(duration)));
  return json(await fetch(`${apiBase()}/api/lyrics?${params}`, { signal }));
}

export async function apiTranslate(text, target = 'id', { signal } = {}) {
  if (await standalone()) {
    // No backend in standalone native mode — use the same free Google
    // endpoint the server uses (server/lyrics.js translateLyrics).
    const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: target || 'id', dt: 't', q: String(text || '') });
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, { signal });
    if (!res.ok) throw new Error(`Translation failed: HTTP ${res.status}`);
    const data = await res.json().catch(() => null);
    const translated = Array.isArray(data?.[0]) ? data[0].map((seg) => seg?.[0] || '').join('') : '';
    return { translated, target: target || 'id' };
  }
  return json(await fetch(`${apiBase()}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target }),
    signal,
  }));
}

/** Crowdsourced skip segments for a track (sponsor/selfpromo/non-music…). */
export async function apiSponsorBlock(id, categories, { signal } = {}) {
  if (await standalone()) {
    const cats = (categories || []).join(',');
    const res = await fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(id)}&categories=${encodeURIComponent(cats)}`, { signal });
    if (res.status === 404) return [];
    return json(res);
  }
  const cats = (categories || []).join(',');
  const params = new URLSearchParams({ id });
  if (cats) params.set('categories', cats);
  return json(await fetch(`${apiBase()}/api/sponsorblock?${params}`, { signal }));
}

/** YouTube video chapters (click-to-seek). */
export async function apiChapters(id, { signal } = {}) {
  // No backend in standalone native mode — chapters need yt-dlp on the
  // server, so report none instead of a fetch error.
  if (await standalone()) return { chapters: [] };
  const params = new URLSearchParams({ id });
  return json(await fetch(`${apiBase()}/api/chapters?${params}`, { signal }));
}

/** Test a BitChord-compatible addon manifest URL. */
export async function apiAddonTest(url, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/addon/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  }));
}

/** Search a configured addon. */
export async function apiAddonSearch(base, q, quality, { signal } = {}) {
  const params = new URLSearchParams({ base: base || '', q, quality: quality || 'LOSSLESS' });
  return json(await fetch(`${apiBase()}/api/addon/search?${params}`, { signal }));
}

/** Build the same-origin proxied URL for an addon track. */
export function addonTrackUrl(base, id, quality) {
  return `${apiBase()}/api/addon/track?base=${encodeURIComponent(base)}&id=${encodeURIComponent(id)}&quality=${encodeURIComponent(quality || 'LOSSLESS')}`;
}

/** Route a remote artwork URL through the local proxy (canvas-safe).
 * Only in standalone native mode (no backend at all) use the direct URL. */
export function coverProxy(url) {
  if (!url) return '';
  const isStandalone = !apiBase() && Boolean(window.Capacitor?.Plugins?.InnerTube);
  return isStandalone ? url : `${apiBase()}/api/cover?url=${encodeURIComponent(url)}`;
}

/** Import a YouTube/Deezer/Spotify link as a playable playlist. */
export async function apiImportLink(url, { gl, hl, signal } = {}) {
  return json(await fetch(`${apiBase()}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, gl, hl }),
    signal,
  }));
}

/** Shared playlist link (7-day expiry). */
export async function apiShareCreate(name, tracks, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tracks }),
    signal,
  }));
}
export async function apiShareGet(id, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/share/${encodeURIComponent(id)}`, { signal }));
}

/** Listen Together */
export async function apiTogetherCreate(name, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/together/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), signal }));
}
export async function apiTogetherJoin(code, name, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/together/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }), signal }));
}
export async function apiTogetherState(code, memberId, { signal } = {}) {
  const qs = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
  return json(await fetch(`${apiBase()}/api/together/${encodeURIComponent(code)}/state${qs}`, { signal }));
}
export async function apiTogetherPush(code, memberId, state, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/together/${encodeURIComponent(code)}/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, state }), signal }));
}
export async function apiTogetherChat(code, memberId, text, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/together/${encodeURIComponent(code)}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, text }), signal }));
}
export async function apiTogetherPresence(code, memberId, track, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/together/${encodeURIComponent(code)}/presence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, track }), signal }));
}
export async function apiTogetherLeave(code, memberId, { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/together/${encodeURIComponent(code)}/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }), signal }));
}
