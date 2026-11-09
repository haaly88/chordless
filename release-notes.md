## Chordless 1.1.0

Every song, beautifully — desktop app (Windows & macOS) **and** a **fully native Android app** (Kotlin + Compose + Media3, BitChord-grade).

### Download

| File | Platform |
|------|----------|
| `Chordless.Setup.1.0.0.exe` | Windows installer (x64) |
| `Chordless.1.0.0.exe` | Windows portable (x64) |
| `Chordless-1.0.0-arm64.dmg` | macOS Apple Silicon (M1/M2/…) |
| `Chordless-1.0.0.dmg` | macOS Intel |
| `Chordless-1.0.0-arm64-mac.zip` | macOS Apple Silicon (zip) |
| `Chordless-1.0.0-mac.zip` | macOS Intel (zip) |
| `app-debug.apk` | Android native APK |

### Android (fully native, standalone)

- **No server, no WebView, no yt-dlp, no Python.** Everything runs natively on the phone.
- Search, Home shelves, Charts, Artist / Album / Playlist pages powered by a native InnerTube client (OkHttp).
- Playback uses real stream URLs resolved via NewPipeExtractor (no YouTube IFrame) in Media3 ExoPlayer.
- Synced lyrics via LRCLIB, SponsorBlock skip segments, favorites library (DataStore), theme + region (GL/HL) settings.
- UI scale defaults to **90%** density.
- Install `app-debug.apk` and allow unknown sources. Debug-signed build for personal use.

### Requirements (desktop)

- **Python 3 + yt-dlp** (`pip install -U yt-dlp`) for stream playback. Without it, use Settings → Playback → Engine → Embedded.
- macOS unsigned: right-click the app and choose **Open** (or `xattr -dr com.apple.quarantine /Applications/Chordless.app`).
- Unsigned Windows installer: accept the SmartScreen prompt (“More info” → “Run anyway”).

### Highlights

- YouTube Music client with synced lyrics (LRCLIB + LRC.red), gapless preload, Listen Together, karaoke mode, smart playlists, offline downloads, spatial audio/EQ.
- Desktop extras: system tray, close-to-tray, launch on startup, song notifications.
- Bilingual EN/ID.
