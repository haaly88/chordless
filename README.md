# Chordless

An aesthetic, ad-free **YouTube Music web client** for the browser — audio only, never video. Inspired by [BitChord](https://github.com/kushagrasinghx/BitChord) and [limusic](https://github.com/SimoHypers/limusic), rebuilt as a local web app.

Plays music straight from YouTube Music (search, home feed, album/track pages), with **line-synced lyrics from [LRCLIB](https://lrclib.net)**, a real-time visualizer, dynamic artwork-driven theming and a full library system (likes, playlists, history, queue) — all stored locally in your browser.

## Features

- **Search & home feed** straight from YouTube Music (Songs / Videos filter, trending chips, "Quick picks", "Recently played")
- **Audio-only streaming** — two engines:
  - **Stream** (default in Auto): local proxy via `yt-dlp` with full HTTP Range support — seeking, low bandwidth
  - **YouTube player** (fallback or forced): hidden YouTube iframe, the officially-sanctioned path — works even when direct streams are throttled/blocked on your network
  - **Auto** (default): tries Stream, falls back to the YouTube player automatically if YouTube throttles
- **Synced lyrics** from LRCLIB — Apple-Music-style large lines, active word highlighting, auto-scroll (suspends on manual scroll, "jump to line" button), click any line to seek, plain-lyrics fallback, ±0.5s sync offset, instrumental detection
- **Dynamic theming** — the whole app recolors itself from the artwork of the track you're playing (extracted via canvas, proxy-safe)
- **Real-time spectrum visualizer** (Web Audio API, no media element taint), animated equalizer indicators on playing tracks
- **Skip sponsor segments** via [SponsorBlock](https://github.com/ajayyy/SponsorBlock) (`sponsor.ajay.app`) — creator-inserted promotional / self-promo / subscribe-reminder / non-music sections are crowdsourced and skipped automatically, with an **Undo** button on each skip; categories configurable in Settings. Note: SponsorBlock does not (and cannot) block the platform’s own ad slots in Embedded mode — the **Stream** engine carries no ads.
- **Library**: Liked Songs, custom playlists (create / rename / delete / reorder covers from member tracks), full history, "Recently played" shelf
- **Queue**: drag-to-reorder, play-next / add-to-queue, clear, **Save as playlist**, survives restarts (restored paused at your position)
- **Playback**: shuffle, repeat off/all/one, playback speed 0.5–2×, sleep timer (fixed presets or “end of this track”), volume + mute, keyboard shortcuts, Media Session API (OS lock-screen controls)
- **Interactions**: right-click context menu on every track (play / play next / queue / like / add-to-playlist with submenu / jump to artist search), toasts, settings with dark/light theme + adaptive accent + listening-history clear
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
| `YT_GL` | `ID` | YouTube region hint for home/search results (e.g. `US`, `GB`, `JP`) |
| `YT_HL` | `en` | UI language hint for YouTube responses |

In-app (Settings, gear icon in the sidebar):

- **Appearance** — dark / light theme
- **Adaptive theme** — recolor from artwork (on by default)
- **Playback engine** — Auto / Stream / YouTube player
- **Stream source** — which YouTube embed client to extract streams through (try switching if a song won't play)
- **Reset app data** — wipe likes, playlists, queue, settings

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
                                        │  → LRCLIB (synced LRC)          │
                                        │ /api/cover                       │
                                        │  → whitelisted artwork proxy     │
                                        └────────────────────────────────┘
```

- **Search / home / metadata** come from YouTube Music’s InnerTube API (`music.youtube.com/youtubei/v1/…`) with no key. Cache: 5–15 min in memory.
- **Streaming** resolves the direct audio URL per track with `yt-dlp --js-runtimes node`, tries embedded clients in order (`tv_embedded → web_safari → ios`), verifies the URL with a 1-byte range request, then streams it through your machine with proper `206 Partial Content` responses (seeking + Web Audio analyser work). Stream URLs are cached ~4 h; failures are negatively cached 45 s.
- **If YouTube refuses** (per-IP throttle / proof-of-origin rollout): you get a toast and, in **Auto** mode, playback automatically switches to the hidden YouTube player. You can also force **YouTube player** in Settings — it always works, at the cost of YouTube serving its usual media pipeline instead of raw audio bytes.
- **Lyrics** are fetched from LRCLIB (`/api/lyrics`) — exact match by artist/track/duration with a search fallback; cached 6 h.
- **Library** (likes, playlists, history, queue, settings) lives in `localStorage` — nothing leaves your machine except the music requests themselves.
- **Artwork** is proxied through `/api/cover` (host-whitelisted) so the canvas may sample it for the adaptive theme.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek ∓5 s |
| `↑` / `↓` | Volume |
| `N` / `P` | Next / previous |
| `L` | Toggle lyrics |
| `Q` | Toggle queue |
| `F` | Now Playing fullscreen |
| `M` | Mute |
| `Ctrl`/`Cmd`+`K` | Focus search |
| `Esc` | Close menus / panels |
| Double-click a row | Play it |
| Right-click a row | Context menu (play next, queue, like, playlist…) |

## Disclaimer

Chordless is an independent, unofficial client. It is **not affiliated with Google or YouTube**. It hosts no media — it streams what YouTube already serves to your browser. Use it for personal listening only, and at your own discretion; you are responsible for complying with YouTube’s Terms of Service and your local copyright law.

Inspired by BitChord (GPL-3.0) and limusic (GPL-3.0). Lyrics by LRCLIB. Built with React, Vite, Express and yt-dlp.
