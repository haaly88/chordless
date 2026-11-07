/**
 * Chordless — Service Worker
 * Caches the app shell (HTML/JS/CSS) for offline / instant reload.
 * Audio streams are NOT cached (they're fetched fresh from YouTube).
 *
 * IMPORTANT: bump CACHE_NAME on every release that changes built assets.
 * The old strategy (cache-first for everything, same version forever)
 * served stale JS indefinitely after deploys.
 */
const CACHE_NAME = 'chordless-v6';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/apple-touch-icon.png',
];

// Install: cache the shell (do not cache '/' — navigations are network-first)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for navigations & HTML, cache-first for hashed assets, never for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API requests — never cached, go straight to network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigations (HTML) — network-first so deploys are picked up immediately,
  // falling back to the cached shell when offline.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
        }
        return res;
      }).catch(() => caches.match('/index.html').then((c) => c || caches.match(request)))
    );
    return;
  }

  // Hashed build assets (/assets/*) — cache-first is safe because filenames
  // change on every build.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else (icons, manifest, ...) — network-first with cache fallback
  event.respondWith(
    fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return res;
    }).catch(() => caches.match(request))
  );
});
