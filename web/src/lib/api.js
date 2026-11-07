/** Thin API client for the Chordless backend. */

async function json(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function apiHealth() {
  return json(await fetch('/api/health'));
}

export async function apiSearch(query, { signal, limit = 40, gl, hl } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  return json(await fetch(`/api/search?${params}`, { signal }));
}

export async function apiHome({ signal, gl, hl } = {}) {
  const params = new URLSearchParams();
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  const qs = params.toString() ? `?${params}` : '';
  return json(await fetch(`/api/home${qs}`, { signal }));
}

export async function apiCharts({ signal, gl, hl } = {}) {
  const params = new URLSearchParams();
  if (gl) params.set('gl', gl);
  if (hl) params.set('hl', hl);
  const qs = params.toString() ? `?${params}` : '';
  return json(await fetch(`/api/charts${qs}`, { signal }));
}

export async function apiPlaylist(id, { signal } = {}) {
  const params = new URLSearchParams({ id });
  return json(await fetch(`/api/playlist?${params}`, { signal }));
}

export async function apiArtist(id, { signal } = {}) {
  const params = new URLSearchParams({ id });
  return json(await fetch(`/api/artist?${params}`, { signal }));
}

export async function apiAlbum(id, { signal } = {}) {
  const params = new URLSearchParams({ id });
  return json(await fetch(`/api/album?${params}`, { signal }));
}

export async function apiLyrics({ artist, track, album, duration }, { signal } = {}) {
  const params = new URLSearchParams({ artist: artist || '', track: track || '' });
  if (album) params.set('album', album);
  if (duration) params.set('duration', String(Math.round(duration)));
  return json(await fetch(`/api/lyrics?${params}`, { signal }));
}

export async function apiTranslate(text, target = 'id', { signal } = {}) {
  return json(await fetch('/api/translate', {
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
  return json(await fetch(`/api/sponsorblock?${params}`, { signal }));
}

/** YouTube video chapters (click-to-seek). */
export async function apiChapters(id, { signal } = {}) {
  const params = new URLSearchParams({ id });
  return json(await fetch(`/api/chapters?${params}`, { signal }));
}

/** Test a BitChord-compatible addon manifest URL. */
export async function apiAddonTest(url, { signal } = {}) {
  return json(await fetch('/api/addon/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  }));
}

/** Search a configured addon. */
export async function apiAddonSearch(base, q, quality, { signal } = {}) {
  const params = new URLSearchParams({ base: base || '', q, quality: quality || 'LOSSLESS' });
  return json(await fetch(`/api/addon/search?${params}`, { signal }));
}

/** Build the same-origin proxied URL for an addon track. */
export function addonTrackUrl(base, id, quality) {
  return `/api/addon/track?base=${encodeURIComponent(base)}&id=${encodeURIComponent(id)}&quality=${encodeURIComponent(quality || 'LOSSLESS')}`;
}

/** Route a remote artwork URL through the local proxy (canvas-safe). */
export function coverProxy(url) {
  return url ? `/api/cover?url=${encodeURIComponent(url)}` : '';
}

/** Import a YouTube/Deezer/Spotify link as a playable playlist. */
export async function apiImportLink(url, { gl, hl, signal } = {}) {
  return json(await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, gl, hl }),
    signal,
  }));
}

/** Shared playlist link (7-day expiry). */
export async function apiShareCreate(name, tracks, { signal } = {}) {
  return json(await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tracks }),
    signal,
  }));
}
export async function apiShareGet(id, { signal } = {}) {
  return json(await fetch(`/api/share/${encodeURIComponent(id)}`, { signal }));
}

/** Listen Together */
export async function apiTogetherCreate(name, { signal } = {}) {
  return json(await fetch('/api/together/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), signal }));
}
export async function apiTogetherJoin(code, name, { signal } = {}) {
  return json(await fetch('/api/together/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, name }), signal }));
}
export async function apiTogetherState(code, memberId, { signal } = {}) {
  const qs = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
  return json(await fetch(`/api/together/${encodeURIComponent(code)}/state${qs}`, { signal }));
}
export async function apiTogetherPush(code, memberId, state, { signal } = {}) {
  return json(await fetch(`/api/together/${encodeURIComponent(code)}/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, state }), signal }));
}
export async function apiTogetherChat(code, memberId, text, { signal } = {}) {
  return json(await fetch(`/api/together/${encodeURIComponent(code)}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, text }), signal }));
}
export async function apiTogetherLeave(code, memberId, { signal } = {}) {
  return json(await fetch(`/api/together/${encodeURIComponent(code)}/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }), signal }));
}
