# Chordless

An aesthetic, ad-free **YouTube Music client** — on the web, on desktop (Windows & macOS) and as a native Android app. Audio only, never video.

Line-synced lyrics · karaoke · gapless & crossfade · EQ & loudness · sponsor-segment skip · offline downloads · Listen Together · statistics · PWA · on-device AI artwork tagging.

## 🌐 Try it

**→ https://haaly88.github.io/chordless/**

Free, no sign-up, no credit card. The link always points to the live instance.

### Run it yourself

```bash
npm run setup     # web deps + yt-dlp
npm run build     # build the UI
npm start         # → http://localhost:3001
```

Or with Docker:

```bash
docker run -d -p 3001:3001 ghcr.io/haaly88/chordless:latest
```

## 📱 Apps

| | |
|---|---|
| **Web** | any browser — installable as a PWA |
| **Desktop** | Windows (x64) and macOS (Intel + Apple Silicon), from the [releases page](https://github.com/haaly88/chordless/releases) |
| **Android** | native Kotlin/Compose app, standalone — it talks to YouTube Music directly, no PC needed |

## Features

**Music** — search & home feed, region-aware charts, playlists and folders, liked songs, queue with drag-to-reorder, smart playlists, history, share links, import from a link, auto collage covers.

**Playback** — stream or YouTube-player engine (auto-fallback between them), network-adaptive quality, crossfade, true gapless with preload, AB loop, skip silence, per-track speed memory, sleep timer, play speed 0.5–2×, media-session keys and lockscreen controls.

**Sound** — 3-band EQ with shareable presets, spatial widening, loudness normalisation, stereo balance, lossless addons with failover, YouTube quality high/medium/low.

**Lyrics** — synced lyrics from [LRCLIB](https://lrclib.net) with an [LRC.red](https://lrc.red) fallback, karaoke mode with click-to-seek, translation in 14 languages, adjustable offset, `.lrc` export.

**Library** — offline downloads that play without a network, sponsor-segment skipping, statistics with streaks and charts, share cards as PNG.

**Together** — host a room, guests join with a code and stay in sync, with chat and reactions.

**Everywhere** — EN/ID, dark/light, adjustable UI scale, adaptive accent colour from the artwork, PWA with offline banner.

## Requirements

- **Node.js 18+** and **Python 3** (for `yt-dlp`) to build and run from source
- The packaged desktop app ships its own binaries — no Node or Python needed on your machine

## Disclaimer

Chordless is an independent, unofficial client and is **not affiliated with Google or YouTube**. It hosts no media; it streams what YouTube already serves to your browser, or what the addons you configure provide. Use it for personal listening, at your own discretion, and comply with YouTube's Terms of Service and your local copyright law.

## Credits

Inspired by [BitChord](https://github.com/kushagrasinghx/BitChord), [LastWave](https://github.com/Clash-Projects/LastWave-Native) and [limusic](https://github.com/SimoHypers/limusic). Lyrics by [LRCLIB](https://lrclib.net) and [LRC.red](https://lrc.red). Built with React, Vite, Express, yt-dlp, Electron and Kotlin/Compose.

Development notes, architecture and deployment details live in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
