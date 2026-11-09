# Chordless Desktop (Electron)

Electron shell for Chordless. The web build (`web/dist`) is served by the
embedded Chordless Node server (`server/`), so playback, lyrics, search and
Listen Together behave exactly like the web app — plus desktop features:

- **System tray** (Open / Play-Pause / Next / Quit)
- **Close to tray** (closing the window hides it)
- **Launch on startup** (Windows login item)
- Native window frame + system notifications (via the web app itself)

## Prerequisites

Same as the web app:

- Python 3 + yt-dlp (`pip install -U yt-dlp`) — the server spawns
  `python -m yt_dlp` for streaming. (Not bundled.)
- Node is **not** needed at runtime: the server runs inside Electron via
  `ELECTRON_RUN_AS_NODE` (`process.execPath`).

## Run (dev)

```bat
npm run build        (from repo root — builds web/dist)
cd desktop
npm install
npm start
```

## Package an installer

```bat
cd desktop
npm run dist
```

Outputs `desktop/dist/`: NSIS installer + portable `.exe`.

## How it works

`main.js` spawns `server/index.js` as a child process (ELECTRON_RUN_AS_NODE),
waits for `/api/health`, then opens the window on `http://127.0.0.1:3001`.
Preferences (close-to-tray, autostart) live in `userData/prefs.json` and are
synced with the renderer's settings over IPC (`window.chordless` preload
bridge). Tray commands (`Play / Pause`, `Next`) are sent to the renderer,
which forwards them to the player store.
