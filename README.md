# Chordless

An aesthetic, ad-free **YouTube Music client** — available as a **web app**, a **native Android app** and a **desktop app** for Windows & macOS. Audio only, never video. Inspired by [BitChord](https://github.com/kushagrasinghx/BitChord), [LastWave](https://github.com/Clash-Projects/LastWave-Native) and [limusic](https://github.com/SimoHypers/limusic).

Plays music straight from YouTube Music (search, home feed, album/track pages), with **line-synced lyrics from [LRCLIB](https://lrclib.net)**, a real-time visualizer, dynamic artwork-driven theming and a full library system.

---

## 🌐 Public URL — free, no credit card

**👉 https://haaly88.github.io/chordless/**

That single link is stable: it always redirects to the live instance. The URL behind it changes every few hours, you never have to care.

How it works (nothing runs on anybody's personal machine):

```
[ GitHub Actions runner ]        ← GitHub's cloud, free minutes for public repos
   ├─ builds the web UI (vite)
   ├─ node server + yt-dlp
   └─ Cloudflare quick tunnel  →  https://xxxx.trycloudflare.com
                    ↓
[ GitHub Pages ]  haaly88.github.io/chordless/  →  redirects to the newest URL
```

- The `Public Chordless server` workflow starts a server, opens the tunnel, smoke-tests it and publishes the URL to `public/current-url.json`.
- It re-runs on a schedule every 5 hours; the keep-alive step restarts the server or the tunnel and re-publishes the URL if anything changes.
- Overlapping runs mean there is no downtime.
- Optional protection: set `CHORDLESS_USER` / `CHORDLESS_PASS` for HTTP basic auth.

### Other ways to run it yourself

| Option | Cost | Notes |
|---|---|---|
| **Hugging Face Space** (Docker) | free, no card | 2 vCPU / 16 GB, always on. New Space → Docker → port `3001` → paste the YAML header from `public/index.html` into the Space README |
| **Docker** | free on any free host | `docker run -d -p 3001:3001 ghcr.io/haaly88/chordless:latest` |
| **Render** | free tier | one click: [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/haaly88/chordless) — uses `render.yaml` (asks for a card on some accounts) |
| **Fly.io / Railway / Koyeb / VPS** | free tier or cheap | `fly.toml` and `Procfile` are included |
| **Own machine** | free | `npm run serve` → http://0.0.0.0:3001 |

The production image is built on every push and published to
`ghcr.io/haaly88/chordless:latest` (public, pull without login).

---

## 📱 Apps

### Android (native, fully standalone)

A complete **Kotlin + Jetpack Compose** app (Material 3 Expressive) — it talks to YouTube Music directly on the device, so it needs **no PC and no server**.

- Playback: Media3 1.11 `ExoPlayer` + foreground service, lockscreen controls, MediaSession
- Streams resolved with NewPipe Extractor, with **muxed (video+audio) fallbacks** — audio-only URLs are refused by YouTube without a proof-of-origin token
- Automatic **stream retry**: when a signed URL is rejected the next candidate is used; a stream stuck buffering for 8 s is re-resolved and resumes at the same position
- Synced lyrics with karaoke highlighting + translation, crossfade, EQ, sleep timer, SponsorBlock
- **Listen Together** rooms (Ktor websocket server), offline downloads, statistics, launcher widget (Glance)
- **On-device AI**: an EfficientNet-Lite model bundled in the APK classifies the cover art into music “vibe” tags
- Onboarding, always-dark theme, UI scale default 100 %, dynamic palette from artwork

Latest debug build: **88.98 MB** (`test-build-android/Chordless-1.1.0-app-debug.apk`).

### Desktop (Electron — Windows & macOS)

The desktop shell embeds the very same Node server and serves the web UI from it.

- Windows (x64), macOS Apple Silicon and macOS Intel, NSIS installer + portable build
- Bundled **universal** `yt-dlp` binary — **no Python and no Node installation required**
- macOS: the app clears the quarantine attribute from its own helper so Gatekeeper cannot block it
- System tray, close-to-tray, launch at login, media keys, in-app update banner

---

## Features

- **Search & home feed** straight from YouTube Music (Songs / Videos filter, trending chips, mood/genre chips, "Quick picks", "Recently played", region-aware charts via `gl/hl`)
- **Audio-only streaming** — two engines:
  - **Stream** (default in Auto): local proxy via `yt-dlp` with full HTTP Range support → seeking, low bandwidth
  - **YouTube player** (fallback or forced): hidden YouTube iframe → works even when direct streams are throttled
  - **Auto** (default): tries Stream, falls back to the YouTube player automatically
- **Fast playback start**: the signed media URL is resolved ahead of time (hover a row, on search, and always for the next track), so a click starts playing in ~1.3 s instead of 12 s
- **Resilient streaming**: several player clients are raced in pairs, a refused URL automatically moves on to the next candidate, and the yt-dlp process pool never starves the request that is actually playing
- **Lossless addons (multi + failover)** — search queries every enabled addon; playback tries the next addon on failure, then YouTube. Order = priority. Deezer preset included (full FLAC needs a personal URL at `deezer.nom.deno.net`)
- **Synced lyrics** from LRCLIB — Apple-Music-style large lines, active line highlight, auto-scroll, click any line to seek, plain-lyrics fallback, A±0.5s offset, instrumental detection, plus **translation** (Google GTX → MyMemory) in 14 languages
- **Karaoke Mode** (`C`) — fullscreen lyric overlay with karaoke progress fill, click-to-seek, font sizes, translate, offset
- **True Gapless + Preload** — dual `<audio>` slots with background preload (10/20/30s ahead). Stream engine only; replaces Crossfade when enabled
- **Crossfade** — fade transition (3/5/8/12s). Mutually exclusive with Gapless
- **For You AI Mix** — local taste engine (`lib/ai-mix.js`) scoring play count, likes, recency and artist affinity, enriched with fresh search picks
- **Smart Playlists** — Recently Added, Most Played, Top Rated (+ For You) in Library
- **Share Card** — 1080×1920 PNG from Now Playing (cover art, title/artist, active lyric line, progress bar, "SHARED FROM CHORDLESS") with Download PNG + Web Share / clipboard copy
- **Listen Together** — host-authoritative sync rooms (code-based join, guest polling, drift correction, host migration, room chat & emoji reactions, per-member presence)
- **Audio** — 3-band EQ + presets, spatial audio (mid/side widening), loudness normalize, stereo balance, playback speed 0.5–2×, YouTube quality high/medium/low, **network-adaptive quality** (downgrades next track on stalls/`navigator.connection`)
- **Skip sponsor segments** via [SponsorBlock](https://github.com/ajayyy/SponsorBlock) with Undo; categories configurable in Settings
- **Library**: Liked Songs, custom playlists (create / rename / delete / reorder covers), playlist folders, share/import via clipboard JSON, export/import library JSON, full history, "Recently played" shelf
- **Queue**: drag-to-reorder, play-next / add-to-queue, clear, Save as playlist, survives restarts (restored paused), queue filter/search
- **Playback**: shuffle (smart, avoids same-artist back-to-back), repeat off/all/one, autoplay/radio (appends similar tracks at queue end), sleep timer, volume + mute, **AB loop** (A/B points), **skip silence**, per-track **speed memory**, customizable keyboard shortcuts, Media Session API
- **Chapters** — YouTube chapter markers on the SeekBar + click-to-seek list in Now Playing; "View chapters" in the track context menu
- **Download for Offline** — IndexedDB blobs per track (context menu, Now Playing, Library shelf with size/clear), plays offline even in embed mode
- **Import from Link** — YouTube Music / Deezer / Spotify playlist-track URLs → playable playlist (`/api/import`)
- **Share Playlist Link** — `/share/{id}` URL (7-day expiry) that imports on open + clipboard JSON
- **Playlist Tools** — sort (A-Z/Z-A/artist/duration), dedupe, merge, bulk select-remove, **Download all**, genre filter; **duplicate finder** across playlists in Library
- **Auto collage cover** — playlist cards auto-build a 4-cover mosaic; custom cover optional
- **Stats** — weekly totals + delta, streak, peak hour, uniques, 24h chart, **Diagnostics** (LCP/CLS/INP, heap, connection), **Export story PNG**
- **Saved Searches** — save query + filter, restore in one tap; **auto-complete** from saved/history/trending
- **PWA** — install prompt (Sidebar "Install app"), offline banner, pull-to-refresh on Home
- **Custom Home shelves** — show/hide + reorder Home sections (Settings → Home sections); auto collage cover in Library
- **Appearance** — dark/light/system, **UI scale (default 90 %)** with 60–100 % options, **reduce motion**, adaptive accent from artwork, **language toggle EN/ID** (core UI + toasts + section labels)
- **Audio advanced** — EQ presets **shareable via clipboard** (Copy/Paste EQ), spatial, normalize, balance, crossfade/gapless, SponsorBlock, adaptive quality, chapters, skip silence
- **Interactions**: right-click context menu, toasts (localized), voice search, search history + saved searches, PWA + service worker, mini visualizer in PlayerBar, title marquee, 3D cover tilt, lyrics cache + `.lrc` export
- **Mobile layout**: sidebar collapses to an off-canvas drawer with hamburger; mini player keeps controls usable
- **Update notifier** — checks GitHub Releases and shows a banner with a Download button (web, desktop and Android)

---

## Requirements

| Tool | Why |
|---|---|
| **Node.js 18+** | backend + build |
| **Python 3 + pip** | required by `yt-dlp` (stream extraction) |
| `yt-dlp` | `pip install -U yt-dlp` — run `npm run setup` to do this and install JS deps |

No YouTube API keys, no Google account, no database. Everything runs locally.

> The packaged desktop app ships its own `yt-dlp` binary and needs **neither Python nor Node** on the machine.

## Quick start

```bat
start.bat            REM Windows: double-click — installs deps, builds, starts, opens browser
```

or manually:

```bash
npm run setup                    # installs web deps + yt-dlp
npm run build                    # build the frontend into web/dist
npm start                        # production server → http://localhost:3001
```

Development mode (hot reload):

```bash
npm run dev      # API on :3001, Vite dev server on :5173 (proxy /api)
```

The app is served from `http://localhost:3001`.

## Configuration

Environment variables (all optional):

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | API/static server port |
| `HOST` | `127.0.0.1` | bind address — use `0.0.0.0` in containers |
| `NODE_ENV` | unset | set to `production` for production mode |
| `CHORDLESS_USER` / `CHORDLESS_PASS` | – | enable HTTP basic auth in front of the app |
| `YT_DLP_BIN` | – | path to a custom `yt-dlp` binary |

Region (`gl/hl`) is detected in the browser (language/timezone) and can be overridden in Settings.

In-app (Settings, gear icon in the sidebar):

- **Appearance** — dark / light / system theme, adaptive accent from artwork, **UI scale (defaults to 90 %)**
- **Region** — custom dropdown with flag/search/keyboard (Auto + manual override)
- **Playback engine** — Auto / Stream / YouTube player
- **Stream source & quality** — YouTube client + high/medium/low, adaptive quality toggle
- **Lossless addons** — add/remove/reorder/enable multi-addons, Deezer preset
- **Audio** — EQ, spatial, normalize, balance, crossfade/gapless, SponsorBlock categories
- **Library data** — export/import JSON, clear history, reset app data

## Project structure

```
server/               Express backend (Node, ESM)
  index.js            routes: /api/search|home|charts|playlist|artist|album|stream|duration|
                      lyrics|translate|cover|sponsorblock|addon/*|together/*
  innertube.js        YouTube InnerTube (WEB_REMIX) client + runtime lookup
  stream.js           yt-dlp stream resolution + Range proxy (multi-client, retries)
  lyrics.js           LRCLIB + translation (GTX → MyMemory)
  together.js         Listen Together in-memory rooms (host migration, TTL)
  addon.js            addon manifest/search/track proxy
  cover.js  cache.js  pool.js  sponsorblock.js  ytdlp.js

web/src/
  store.js            zustand store: playback, gapless dual-audio, Web Audio chain,
                      together sync, library. Pure helpers extracted to lib/* and
                      re-exported here for backwards compatibility.
  App.jsx             shell: views, audio wiring, media session, shortcuts, together polling
  components/         22 components (Home, Search, Library, NowPlaying, Karaoke,
                      ListenTogetherModal, Queue, Settings, PlayerBar, …)
  lib/
    api.js            fetch client for /api/* incl. gl/hl, addon, together
    storage.js        localStorage helpers (cl:* JSON + plain-string, bc:* migration)
    quality.js        streamSrc + warmSrc + network-adaptive quality (pure)
    sb.js             SponsorBlock labels/categories (pure)
    shuffle.js        uid / shuffled / smartShuffle / sameTrack (pure)
    embed.js          YouTube IFrame bridge + isEmbedEngine (pure)
    ai-mix.js         For You taste engine (scoring + interleaving)
    region.js         region detection + REGION_OPTIONS
    lrc.js  format.js  palette.js  thumb.js
  styles.css          single stylesheet (base + Beautify v2 override layer)
web/public/           sw.js (PWA cache), manifest.json, icons

desktop/              Electron shell (Windows + macOS)
  main.js             window, tray, server lifecycle, port fallback, update banner
  preload.cjs         context-isolated bridge
  scripts/            icon generators
  build/yt-dlp/       bundled yt-dlp binary per platform

mobile/android/       native Android app (Kotlin, Compose, Media3)
  app/src/main/java/app/chordless/music/
    data/             InnerTube client, streams, lyrics, library, addons
    player/           PlayerManager (Media3), PlaybackService, MediaButtonReceiver
    ui/               Compose screens (Home, NowPlaying, Lyrics, Library, Stats…)
    download/         offline downloads
    together/         Listen Together (Ktor)
    widget/           Glance launcher widget
  app/src/main/assets/ bundled AI model + labels

public/               GitHub Pages redirect site (points at the live instance)
Dockerfile            production image (web build + server + yt-dlp)
render.yaml  fly.toml  Procfile
```

## How it works

```
 Browser (React SPA)                 Server (Express)                     Upstream
 ┌───────────────────────┐   /api/*   ┌──────────────────────────────┐   ┌─────────────┐
 │ Home · Search · Lib   │ ◄────────► │ /api/search /api/home        │ ◄─│ YouTube     │
 │ Player bar · Now Ply. │            │  → InnerTube (WEB_REMIX)      │   │ Music      │
 │ Queue · Lyrics panel  │  stream    │ /api/stream/:id                │ ◄─│ yt-dlp →   │
 │ Visualizer (WebAudio) │ ◄────────► │  → multi-client resolution    │   │ googlevideo│
 └───────────────────────┘  range     │  → Range-aware proxy          │   └─────────────┘
                                       │ /api/lyrics → LRCLIB           │
                                       │ /api/cover  → artwork proxy    │
                                       └──────────────────────────────┘
```

- **Search / home / metadata** come from YouTube Music's InnerTube API with no key. Cache: 5–15 min in memory.
- **Runtimes** are missing from the InnerTube responses, so the server asks the player endpoint for them and caches them for 6 h (`GET /api/duration/:id`).
- **Streaming** resolves the direct media URL per track with `yt-dlp`. The player clients are raced in pairs, the first one that resolves wins, and the *real* fetch is the verification — a separate “verification” request per client used to double the CDN traffic and made YouTube answer with 403. A refused URL automatically moves on to the next candidate, and the yt-dlp process pool is kept free so a background warm-up can never delay the track you are actually playing.
- **Warm-up**: `GET /api/stream/:id?warm=1` resolves a URL ahead of time (on hover, on search, and always for the next track). The UI therefore asks for a cached URL and starts playing in ~1.3 s.
- **If YouTube refuses**: toast + automatic fallback to the hidden YouTube player in Auto mode.
- **Lyrics** are fetched from LRCLIB (`/api/lyrics`) — exact match by artist/track/duration with search fallback; cached 6 h.
- **Library** (likes, playlists, history, queue, settings, shortcuts, together name) lives in `localStorage` under `cl:*` — nothing leaves your machine except the music requests themselves.
- **Artwork** is proxied through `/api/cover` (host-whitelisted) so the canvas may sample it for the adaptive theme and Share Card.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek ∓5 s |
| `↑` / `↓` | Volume |
| `N` / `P` | Next / previous |
| `L` | Toggle lyrics |
| `C` | Toggle Karaoke Mode |
| `Q` | Toggle queue |
| `F` | Now Playing fullscreen |
| `M` | Mute |
| `Ctrl`/`Cmd`+`K` | Focus search |
| `Esc` | Close menus / panels |
| Double-click a row | Play it |
| Right-click a row | Context menu (play next, queue, like, playlist…) |

## Disclaimer

Chordless is an independent, unofficial client. It is **not affiliated with Google or YouTube**. It hosts no media — it streams what YouTube already serves to your browser (or what addons you configure). Use it for personal listening only, and at your own discretion; you are responsible for complying with YouTube's Terms of Service and your local copyright law.

Inspired by BitChord (GPL-3.0), LastWave (GPL-3.0) and limusic (GPL-3.0). Lyrics by LRCLIB. Built with React, Vite, Express, yt-dlp, Electron and Kotlin/Compose.
