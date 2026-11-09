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

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function apiHealth() {
  return json(await fetch(`${apiBase()}/api/health`));
}

export async function apiSearch(query, { signal, limit = 40, gl, hl } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  return json(await fetch(`${apiBase()}/api/search?${params}`, { signal }));
}

export async function apiHome({ signal, gl, hl } = {}) {
  const params = new URLSearchParams();
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  const qs = params.toString() ? `?${params}` : '';
  return json(await fetch(`${apiBase()}/api/home${qs}`, { signal }));
}

export async function apiCharts({ signal, gl, hl } = {}) {
  const params = new URLSearchParams();
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  const qs = params.toString() ? `?${params}` : '';
  return json(await fetch(`${apiBase()}/api/charts${qs}`, { signal }));
}

export async function apiPlaylist(id, { signal } = {}) {
  const params = new URLSearchParams({ id });
  return json(await fetch(`${apiBase()}/api/playlist?${params}`, { signal }));
}

export async function apiArtist(id, { signal } = {}) {
  const params = new URLSearchParams({ id });
  return json(await fetch(`${apiBase()}/api/artist?${params}`, { signal }));
}

export async function apiAlbum(id, { signal } = {}) {
  const params = new URLSearchParams({ id });
  return json(await fetch(`${apiBase()}/api/album?${params}`, { signal }));
}

export async function apiLyrics({ artist, track, album, duration }, { signal } = {}) {
  const params = new URLSearchParams({ artist: artist || '', track: track || '' });
  if (album) params.set('album', album);
  if (duration) params.set('duration', String(Math.round(duration)));
  return json(await fetch(`${apiBase()}/api/lyrics?${params}`, { signal }));
}

export async function apiTranslate(text, target = 'id', { signal } = {}) {
  return json(await fetch(`${apiBase()}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target }),
    signal,
  }));
}

/** Crowdsourced skip segments for a track (sponsor/selfpromo/non-music…). */
export async function apiSponsorBlock(id, categories, { signal } = {}) {
  const cats = (categories || []).join(',');
  const params = new URLSearchParams({ id });
  if (cats) params.set('categories', cats);
  return json(await fetch(`${apiBase()}/api/sponsorblock?${params}`, { signal }));
}

/** YouTube video chapters (click-to-seek). */
export async function apiChapters(id, { signal } = {}) {
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

/** Route a remote artwork URL through the local proxy (canvas-safe). */
export function coverProxy(url) {
  return url ? `${apiBase()}/api/cover?url=${encodeURIComponent(url)}` : '';
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
