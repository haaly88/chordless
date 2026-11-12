# Chordless — development notes

Architecture, internals and deployment details. The public README stays short on purpose.

---

## 1. Architecture

```
 Browser (React SPA)                 Server (Express)                     Upstream
 ┌───────────────────────┐   /api/*   ┌──────────────────────────────┐   ┌─────────────┐
 │ Home · Search · Lib   │ ◄────────► │ /api/search /api/home        │ ◄─│ YouTube     │
 │ Player bar · Now Ply. │            │  → InnerTube (WEB_REMIX)      │   │ Music      │
 │ Queue · Lyrics panel  │  stream    │ /api/stream/:id                │ ◄─│ yt-dlp →   │
 │ Visualizer (WebAudio) │ ◄────────► │  → multi-client resolution    │   │ googlevideo│
 └───────────────────────┘  range     │  → Range-aware proxy          │   └─────────────┘
                                       │ /api/lyrics → LRCLIB + LRC.red│
                                       │ /api/cover  → artwork proxy    │
                                       └──────────────────────────────┘
```

### Server (`server/`, Node ESM)

| File | Purpose |
|---|---|
| `index.js` | routes: `/api/search|home|charts|playlist|artist|album|stream|duration|lyrics|translate|cover|sponsorblock|addon/*|together/*` |
| `innertube.js` | InnerTube (WEB_REMIX) client — search, home, charts, pages, runtime lookup |
| `stream.js` | media URL resolution + Range-aware proxy |
| `lyrics.js` | LRCLIB + LRC.red fallback + translation (Google GTX → MyMemory) |
| `together.js` | Listen Together rooms (host migration, TTL) |
| `addon.js` | addon manifest / search / track proxy |
| `pool.js` | global yt-dlp concurrency pool |
| `ytdlp.js` | locates the yt-dlp binary (bundled, PATH, or python module) |
| `cover.js` `cache.js` `sponsorblock.js` | artwork proxy, TTL cache, SponsorBlock |

### Web (`web/src/`)

`store.js` is a zustand store (playback, gapless dual-audio, Web Audio chain, together sync, library). Pure helpers live in `lib/*`. `components/` holds the 22 views. `styles.css` is a single stylesheet.

### Desktop (`desktop/`)

Electron shell: spawns the bundled Node server, serves the built UI, system tray, close-to-tray, launch at login, in-app update banner.

### Android (`mobile/android/`)

Kotlin + Compose (Material 3): Media3 `ExoPlayer` + foreground service, NewPipe Extractor, Glance widget, Ktor Listen Together server, bundled AI model.

---

## 2. Stream resolution

YouTube rejects **audio-only** media URLs without a proof-of-origin token, so the resolver asks for the **muxed** (video + audio) rendition — the smallest one that still carries audio — and only from clients that are still served.

Rules the implementation follows:

- **One request per play.** Resolution never touches the media CDN; the real fetch is the verification. A separate verification request per client used to double the traffic and made YouTube answer 403.
- **Clients raced in pairs** so a client that cannot serve a track never delays the result, and the yt-dlp pool stays free for the track that is actually playing.
- **A refused URL moves on** to the next candidate instead of failing the track.
- **Warm-up**: `GET /api/stream/:id?warm=1` resolves a URL ahead of time (on hover, on search, and always for the next track) and is serialised so background work cannot starve a play request. Result: a click starts playing in ~1.3 s instead of ~12 s.
- **Fallback**: when direct streams are refused the app switches to the hidden YouTube player automatically.

Runtimes are not part of the InnerTube responses, so they are fetched from the player endpoint and cached for 6 h (`GET /api/duration/:id`).

---

## 3. Public instance

```
[ GitHub Actions runner ]     ← GitHub's cloud; free minutes for public repos
   ├─ builds the web UI
   ├─ node server + yt-dlp
   └─ Cloudflare quick tunnel  →  https://xxxx.trycloudflare.com
                    ↓
[ GitHub Pages ]  haaly88.github.io/chordless/  →  redirects to the newest URL
```

- Workflow: `.github/workflows/public-server.yml` — runs on a schedule, smoke-tests the tunnel, publishes the URL to `public/current-url.json` and deploys the Pages redirect.
- The Pages deploy happens inside that same job: commits made with `GITHUB_TOKEN` never trigger other workflows.
- The keep-alive step restarts the server or the tunnel and re-publishes the URL if it changes.
- Runs overlap, so there is no downtime.

### Other hosting options

| Option | Notes |
|---|---|
| Hugging Face Space (Docker) | free, no card; port `3001`, front matter in the Space README |
| Docker | `ghcr.io/haaly88/chordless:latest` is public |
| Render / Fly.io / Railway / Koyeb / VPS | `render.yaml`, `fly.toml`, `Procfile` are included |

---

## 4. Configuration

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | API/static server port |
| `HOST` | `127.0.0.1` | bind address — `0.0.0.0` in containers |
| `NODE_ENV` | unset | `production` for production mode |
| `CHORDLESS_USER` / `CHORDLESS_PASS` | – | HTTP basic auth in front of the app |
| `YT_DLP_BIN` | – | path to a custom `yt-dlp` binary |
| `YT_DLP_COOKIES` | – | path to a Netscape `cookies.txt` (see below) |
| `YT_DLP_COOKIES_FROM_BROWSER` | – | read cookies from a local browser profile (`chrome`, `firefox`, …) |
| `YT_GL` / `YT_HL` | `ID` / `en` | fallback region (the browser usually detects it) |

### YouTube's bot check on datacenter IPs

YouTube answers requests from cloud IPs with
`Sign in to confirm you're not a bot` — the stream proxy (and therefore
offline downloads) then cannot resolve anything. The standard remedy is a
cookies file of a signed-in browser:

```bash
# Netscape format export of a signed-in YouTube session
YT_DLP_COOKIES=/path/cookies.txt npm start
```

For the public instance the same works as a repository secret: store the
base64 of `cookies.txt` as `YTDLP_COOKIES_B64` and the workflow installs it
inside the runner (it is only ever used there, never committed).

Without cookies the app still works — playback falls back to the YouTube
player — but the fast stream path and offline downloads stay unavailable.

In-app settings: theme, UI scale (default 90 %), region, playback engine, stream client & quality, addons, EQ/spatial/normalise/balance, crossfade & gapless, SponsorBlock categories, library import/export.

---

## 5. Project structure

```
server/               Express backend (Node, ESM)
web/src/
  store.js            zustand store
  App.jsx             shell: views, audio wiring, media session, shortcuts
  components/         22 components
  lib/                api, storage, quality, sb, shuffle, embed, ai-mix, region, …
  styles.css          single stylesheet
web/public/           sw.js (PWA cache), manifest.json, icons
desktop/              Electron shell (Windows + macOS)
  main.js  preload.cjs  scripts/  build/yt-dlp/
mobile/android/       native Android app (Kotlin, Compose, Media3)
public/               GitHub Pages redirect site
docs/                 this file
Dockerfile  render.yaml  fly.toml  Procfile
```

---

## 6. Keyboard shortcuts

| Keys | Action |
|---|---|
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek ∓5 s |
| `↑` / `↓` | Volume |
| `N` / `P` | Next / previous |
| `L` / `C` | Lyrics / Karaoke Mode |
| `Q` / `F` | Queue / Now Playing |
| `M` | Mute |
| `Ctrl`/`Cmd`+`K` | Focus search |
| `Esc` | Close menus / panels |
| Double-click a row | Play it |
| Right-click a row | Context menu |

---

## 7. Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `public-server.yml` | schedule + manual | serve the app publicly, tunnel, publish the URL |
| `build-apps.yml` | tags + manual | Windows/macOS installers |
| `build-android.yml` | push to `main` + tags | Android debug APK |
| `docker-publish.yml` | push to `main` | production image → GHCR |
| `pages.yml` | push to `public/` | GitHub Pages site |
