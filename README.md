# Chordless

An aesthetic, ad-free **YouTube Music web client** for the browser — audio only, never video. Inspired by [BitChord](https://github.com/kushagrasinghx/BitChord) and [limusic](https://github.com/SimoHypers/limusic), rebuilt as a local web app.

Plays music straight from YouTube Music (search, home feed, album/track pages), with **line-synced lyrics from [LRCLIB](https://lrclib.net)**, a real-time visualizer, dynamic artwork-driven theming and a full library system — all stored locally in your browser.

---

## 🌐 Public URL (100% gratis)

The web app is a single Node server (UI + API + stream proxy), so it runs fine on any
container host. Three ways to get a public URL — **all free, no card needed**:

### 1) Hugging Face Space — free, no card (recommended)

1. Create a free account at [huggingface.co](https://huggingface.co)
2. **New Space → Docker** → give it a name → in *Space* config set the port to `3001`
3. *(optional)* Under **Files → README.md** paste this instead of the template body:

   ```yaml
   ---
   title: Chordless
   emoji: 🎵
   colorFrom: red
   colorTo: black
   sdk: docker
   app_port: 3001
   pinned: false
   ---
   ```

4. **Settings → Variables and secrets → New variable** → add
   `CHORDLESS_USER` and `CHORDLESS_PASS` to protect the URL with a login prompt
   (optional but recommended for a public URL)
5. **Restart the Space**

Your URL: `https://<your-space-name>.hf.space` — live 24/7, no credit card, free tier
(2 vCPU / 16 GB).

### 2) Render — one click

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/haaly88/chordless)

Uses [`render.yaml`](render.yaml) (Docker image, health check on `/api/health`).
Set `CHORDLESS_USER` / `CHORDLESS_PASS` in the dashboard to put a login prompt in front.

### 3) Any container host

The repo publishes a ready-to-run image to GitHub Container Registry:

```bash
docker run -d -p 3001:3001 --name chordless ghcr.io/haaly88/chordless:latest
```

Works as-is on Fly.io, Railway, Koyeb, Repli, or any VPS. `fly.toml` is included.

### Local / own server

```bash
npm install && npm --prefix web install && npm run build
npm run serve          # http://0.0.0.0:3001
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | bind address (`0.0.0.0` in containers) |
| `PORT` | `3001` | port |
| `CHORDLESS_USER` / `CHORDLESS_PASS` | – | enable HTTP basic auth |
| `YT_DLP_BIN` | – | path to a custom yt-dlp binary |

---

## Features

- **Search & home feed** straight from YouTube Music (Songs / Videos filter, trending chips, mood/genre chips, "Quick picks", "Recently played", region-aware charts via `gl/hl`)
- **Audio-only streaming** — two engines:
  - **Stream** (default in Auto): local proxy via `yt-dlp` with full HTTP Range support — seeking, low bandwidth
  - **YouTube player** (fallback or forced): hidden YouTube iframe — works even when direct streams are throttled
  - **Auto** (default): tries Stream, falls back to the YouTube player automatically
- **Lossless addons (multi + failover)** — search queries every enabled addon; playback tries the next addon on failure, then YouTube. Order = priority. Deezer preset included (full FLAC needs a personal URL at `deezer.nom.deno.net`)
- **Synced lyrics** from LRCLIB — Apple-Music-style large lines, active line highlight, auto-scroll, click any line to seek, plain-lyrics fallback, ±0.5s offset, instrumental detection, plus **translation** (Google GTX → MyMemory) in 14 languages
- **Karaoke Mode** (`C`) — fullscreen lyric overlay with karaoke progress fill, click-to-seek, font sizes, translate, offset
- **True Gapless + Preload** — dual `<audio>` slots with background preload (10/20/30s ahead). Stream engine only; replaces Crossfade when enabled
- **Crossfade** — fade transition (3/5/8/12s). Mutually exclusive with Gapless
- **For You AI Mix** — local taste engine (`lib/ai-mix.js`) scoring play count, likes, recency and artist affinity, enriched with fresh search picks
- **Smart Playlists** — Recently Added, Most Played, Top Rated (+ For You) in Library
- **Share Card** — 1080×1080 PNG from Now Playing (cover art, title/artist, active lyric line, progress bar, "SHARED FROM CHORDLESS") with Download PNG + Web Share / clipboard copy
- **Listen Together** — host-authoritative sync rooms (code-based join, guest polling, drift correction, host migration)
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
- **Listen Together** — host-authoritative sync + **room chat & emoji reactions** + per-member presence (now playing)
- **Custom Home shelves** — show/hide + reorder Home sections (Settings → Home sections); auto collage cover in Library
- **Appearance** — dark/light/system, **text size** (Compact/Default/Large), **reduce motion**, adaptive accent from artwork, **language toggle EN/ID** (core UI + toasts + section labels)
- **Audio advanced** — EQ presets **shareable via clipboard** (Copy/Paste EQ), spatial, normalize, balance, crossfade/gapless, SponsorBlock, adaptive quality, chapters, skip silence
- **Library**: Liked Songs, custom playlists, folders, share/import via clipboard JSON **+ share link**, import from external link, **duplicate finder**, export/import library JSON, full history, "Recently played" shelf, **Downloaded** shelf
- **Queue**: drag-to-reorder, play-next / add-to-queue, clear, Save as playlist, survives restarts, queue filter/search
- **Interactions**: right-click context menu, toasts (localized), voice search, search history + saved searches, PWA + service worker, mini visualizer in PlayerBar, title marquee, 3D cover tilt, lyrics cache + `.lrc` export
- **Mobile layout**: sidebar collapses to an off-canvas drawer with hamburger; mini player keeps controls usable

## Requirements

| Tool | Why |
|---|---|
| **Node.js 18+** | backend + build |
| **Python 3 + pip** | required by `yt-dlp` (stream extraction) |
| `yt-dlp` | `pip install -U yt-dlp` — run `npm run setup` to do this and install JS deps |

No YouTube API keys, no Google account, no database. Everything runs locally.

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

Environment variables (optional):

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | API/static server port |
| `NODE_ENV` | unset | Set to `production` for production mode |

Region (`gl/hl`) is detected in the browser (language/timezone) and can be overridden in Settings — server-side `YT_GL`/`YT_HL` are no longer used.

In-app (Settings, gear icon in the sidebar):

- **Appearance** — dark / light / system theme, adaptive accent from artwork
- **Region** — custom dropdown with flag/search/keyboard (Auto + manual override)
- **Playback engine** — Auto / Stream / YouTube player
- **Stream source & quality** — YouTube client + high/medium/low, adaptive quality toggle
- **Lossless addons** — add/remove/reorder/enable multi-addons, Deezer preset
- **Audio** — EQ, spatial, normalize, balance, crossfade/gapless, SponsorBlock categories
- **Library data** — export/import JSON, clear history, reset app data

## Project structure

```
server/               Express backend (Node, ESM)
  index.js            routes: /api/search|home|charts|playlist|artist|album|stream|lyrics|translate|cover|sponsorblock|addon/*|together/*
  innertube.js        YouTube InnerTube (WEB_REMIX) client
  stream.js           yt-dlp stream extraction + Range proxy
  lyrics.js           LRCLIB + translation (GTX → MyMemory)
  together.js         Listen Together in-memory rooms (host migration, TTL)
  addon.js            addon manifest/search/track proxy
  cover.js  cache.js  sponsorblock.js

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
    quality.js        streamSrc + network-adaptive quality (pure)
    sb.js             SponsorBlock labels/categories (pure)
    shuffle.js        uid / shuffled / smartShuffle / sameTrack (pure)
    embed.js          YouTube IFrame bridge + isEmbedEngine (pure)
    ai-mix.js         For You taste engine (scoring + interleaving)
    region.js         region detection + REGION_OPTIONS
    lrc.js  format.js  palette.js  thumb.js
  styles.css          single stylesheet (base + Beautify v2 override layer)
web/public/           sw.js (PWA cache), manifest.json, icons
```

## How it works

```
 Browser (React SPA)                 Local server (Express)
 ┌───────────────────────┐   /api/*   ┌────────────────────────────────┐
 │ Home · Search · Lib   │ ◄────────► │ /api/search /api/home          │
 │ Player bar · Now Ply. │            │  → YouTube InnerTube (WEB_REMIX)│
 │ Queue · Lyrics panel  │  stream    │ /api/stream/:id                │
 │ Visualizer (WebAudio) │ ◄────────► │  → yt-dlp -g → googlevideo      │
 └───────────────────────┘  range     │  → Range-aware proxy            │
                                        │ /api/lyrics                    │
                                        │  → LRCLIB (synced LRC) + translate│
                                        │ /api/cover                     │
                                        │  → whitelisted artwork proxy     │
                                        └────────────────────────────────┘
```

- **Search / home / metadata** come from YouTube Music's InnerTube API with no key. Cache: 5–15 min in memory.
- **Streaming** resolves the direct audio URL per track with `yt-dlp`, tries embedded clients in order, verifies with a 1-byte range request, then streams with proper `206 Partial Content` (seeking + Web Audio analyser work). Stream URLs cached ~4 h; failures negatively cached 45 s.
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

Inspired by BitChord (GPL-3.0) and limusic (GPL-3.0). Lyrics by LRCLIB. Built with React, Vite, Express and yt-dlp.
