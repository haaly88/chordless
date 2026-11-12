/**
 * Chordless — offline downloads (IndexedDB).
 * Stores audio blobs per track id so playback works without network.
 * Audio is fetched from the same-origin stream/addon URL at download time.
 */

const DB_NAME = 'chordless-offline';
const STORE = 'tracks';
const urlCache = new Map(); // id -> objectURL (kept alive while app runs)

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not available in this browser.'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Could not open offline storage.'));
  });
}

function tx(mode, run) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Offline storage failed.'));
    db.onclose = () => {};
  }));
}

export async function hasOffline(id) {
  if (!id) return false;
  return tx('readonly', (s) => s.get(id)).then((rec) => Boolean(rec?.blob)).catch(() => false);
}

export async function listOfflineIds() {
  return tx('readonly', (s) => s.getAllKeys()).then((keys) => (keys || []).map(String)).catch(() => []);
}

/** All downloaded entries (metadata + blob) — used for the library shelf. */
export async function listOfflineEntries() {
  return tx('readonly', (s) => s.getAll()).then((all) => (all || []).map((r) => ({
    id: r.id,
    track: r.track || { id: r.id, title: 'Downloaded track', artist: '', duration: r.duration || 0, thumbnail: '' },
    size: r.size || r.blob?.size || 0,
    mime: r.mime || r.blob?.type || '',
    downloadedAt: r.downloadedAt || 0,
  }))).catch(() => []);
}

export async function getOfflineUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await tx('readonly', (s) => s.get(id)).catch(() => null);
  if (!rec?.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export async function saveOffline(track, url, onProgress) {
  if (!track?.id || !url) throw new Error('Cannot download this track.');
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('The server cannot reach YouTube right now, so the audio could not be fetched. Use the desktop app or a self-hosted server for offline downloads.');
    }
    throw new Error(`Download failed (HTTP ${res.status}).`);
  }

  // Stream the body so the UI can show progress instead of appearing frozen.
  let blob;
  const total = Number(res.headers.get('content-length') || 0);
  if (res.body && typeof onProgress === 'function') {
    const reader = res.body.getReader();
    const parts = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      received += value.length;
      onProgress(total > 0 ? Math.min(0.99, received / total) : 0, received, total);
    }
    blob = new Blob(parts, { type: res.headers.get('content-type') || 'audio/mpeg' });
  } else {
    blob = await res.blob();
  }
  if (!blob.size) throw new Error('Downloaded an empty file.');
  const rec = {
    id: track.id,
    track: { ...track },
    blob,
    mime: blob.type || '',
    size: blob.size,
    duration: track.duration || 0,
    downloadedAt: Date.now(),
  };
  await tx('readwrite', (s) => s.put(rec));
  if (urlCache.has(track.id)) {
    try { URL.revokeObjectURL(urlCache.get(track.id)); } catch { /* ignore */ }
    urlCache.delete(track.id);
  }
  return rec;
}

export async function removeOffline(id) {
  if (!id) return;
  await tx('readwrite', (s) => s.delete(id)).catch(() => {});
  if (urlCache.has(id)) {
    try { URL.revokeObjectURL(urlCache.get(id)); } catch { /* ignore */ }
    urlCache.delete(id);
  }
}

export async function clearOffline() {
  await tx('readwrite', (s) => s.clear()).catch(() => {});
  for (const url of urlCache.values()) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
  urlCache.clear();
}

export async function offlineBytes() {
  const entries = await listOfflineEntries();
  return entries.reduce((s, e) => s + (e.size || 0), 0);
}
