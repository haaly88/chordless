## Chordless 1.0.2

Every song, beautifully — now as a desktop app (Windows & macOS) **and** an Android app.

### Download

| File | Platform |
|------|----------|
| `Chordless.Setup.1.0.0.exe` | Windows installer (x64) |
| `Chordless.1.0.0.exe` | Windows portable (x64) |
| `Chordless-1.0.0-arm64.dmg` | macOS Apple Silicon (M1/M2/…) |
| `Chordless-1.0.0.dmg` | macOS Intel |
| `Chordless-1.0.0-arm64-mac.zip` | macOS Apple Silicon (zip) |
| `Chordless-1.0.0-mac.zip` | macOS Intel (zip) |
| `app-debug.apk` | Android APK (debug build) |

### Requirements

- **Android**: install `app-debug.apk` and allow unknown sources. Playback works fully offline of any server via the embedded YouTube player. For search/browse in the Android app, deploy the backend once to a free public host (Render Blueprint — see `render.yaml` in the repo) and paste the URL into Settings → General → **Backend server (Android)**. Your own PC is not involved.
- **Python 3 + yt-dlp** (`pip install -U yt-dlp`) for stream playback. Without it, use Settings → Playback → Engine → Embedded.
- macOS unsigned: right-click the app and choose **Open** (or `xattr -dr com.apple.quarantine /Applications/Chordless.app`).
- Unsigned Windows installer: accept the SmartScreen prompt (“More info” → “Run anyway”).

### Highlights

- YouTube Music client with synced lyrics (LRCLIB + LRC.red), gapless preload, Listen Together, karaoke mode, smart playlists, offline downloads, spatial audio/EQ.
- Desktop extras: system tray, close-to-tray, launch on startup, song notifications.
- Bilingual EN/ID.
