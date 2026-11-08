import { useEffect, useMemo, useState, useCallback, Component, lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';
import usePlayer, { audio, audioB, streamSrc, write, setPendingInstallPrompt } from './store.js';
import HomeView from './components/HomeView.jsx';
import Sidebar from './components/Sidebar.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import EmbedEngine from './components/EmbedEngine.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import Toasts from './components/Toasts.jsx';
import { extractPalette } from './lib/palette.js';
import { apiHealth, coverProxy, addonTrackUrl } from './lib/api.js';

// Lazy views — split out of the initial bundle (Home/shell stay eager).
const SearchView = lazy(() => import('./components/SearchView.jsx'));
const CollectionView = lazy(() => import('./components/CollectionView.jsx'));
const LibraryView = lazy(() => import('./components/LibraryView.jsx'));
const StatsView = lazy(() => import('./components/StatsView.jsx'));
const YtPlaylistView = lazy(() => import('./components/YtPlaylistView.jsx'));
const ArtistView = lazy(() => import('./components/ArtistView.jsx'));
const AlbumView = lazy(() => import('./components/AlbumView.jsx'));
const NowPlaying = lazy(() => import('./components/NowPlaying.jsx'));
const KaraokeMode = lazy(() => import('./components/KaraokeMode.jsx'));
const ListenTogetherModal = lazy(() => import('./components/ListenTogetherModal.jsx'));
const QueuePanel = lazy(() => import('./components/QueuePanel.jsx'));
const SettingsModal = lazy(() => import('./components/SettingsModal.jsx'));

class ViewErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[ViewErrorBoundary]', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" role="alert">
          <h3>Something went wrong</h3>
          <p>{this.state.error.message || 'This view crashed.'} Try reloading — your library and queue are safe.</p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const view = usePlayer((s) => s.view);
  const nowPlayingOpen = usePlayer((s) => s.nowPlayingOpen);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const settingsOpen = usePlayer((s) => s.settingsOpen);
  const karaokeOpen = usePlayer((s) => s.karaokeOpen);
  const togetherOpen = usePlayer((s) => s.togetherOpen);
  const closeMenu = usePlayer((s) => s.closeMenu);
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const theme = usePlayer((s) => s.settings.theme);
  const adaptive = usePlayer((s) => s.settings.adaptive);
  const thumbnail = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.thumbnail : null));
  const title = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.title : null));
  const artist = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.artist : null));
  const album = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.album : null));
  const isPlaying = usePlayer((s) => s.isPlaying);
  const duration = usePlayer((s) => s.duration);
  const currentTime = usePlayer((s) => s.currentTime);
  const queueLength = usePlayer((s) => s.queue.length);
  const restorePosition = usePlayer((s) => s.restorePosition);
  const hasRestoredQueue = usePlayer((s) => s.hasRestoredQueue);

  // ---------- theme (dark / light / system) ----------
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');

    const apply = (resolved) => {
      root.dataset.theme = resolved;
      if (meta) meta.content = resolved === 'light' ? '#f4f4f7' : '#0b0b0e';
    };

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const resolved = mq.matches ? 'dark' : 'light';
      apply(resolved);
      const onChange = (e) => apply(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    apply(theme);
  }, [theme]);

  // ---------- text size + reduce motion ----------
  const fontScale = usePlayer((s) => s.settings.fontScale || 1);
  const reduceMotion = usePlayer((s) => Boolean(s.settings.reduceMotion));
  useEffect(() => {
    const root = document.documentElement;
    // Chromium/Edge honor `zoom` on the root; Firefox falls back to font-size.
    if ('zoom' in root.style) root.style.zoom = String(fontScale);
    else root.style.fontSize = `${16 * fontScale}px`;
    root.classList.toggle('reduce-motion', reduceMotion);
    return () => {
      if ('zoom' in root.style) root.style.zoom = '';
      else root.style.fontSize = '';
    };
  }, [fontScale, reduceMotion]);

  // ---------- adaptive accent from artwork ----------
  useEffect(() => {
    const root = document.documentElement;
    if (!adaptive || !thumbnail) {
      root.style.removeProperty('--accent');
      return undefined;
    }
    let cancelled = false;
    extractPalette(thumbnail).then((palette) => {
      if (cancelled) return;
      if (palette?.accent) root.style.setProperty('--accent', palette.accent);
      else root.style.removeProperty('--accent');
    });
    return () => { cancelled = true; };
  }, [thumbnail, adaptive]);

  // ---------- wire audio element events once ----------
  useEffect(() => {
    const s = usePlayer.getState();
    const els = [audio, audioB];
    for (const el of els) {
      el.addEventListener('timeupdate', s.handleTimeUpdate);
      el.addEventListener('durationchange', s.handleDurationChange);
      el.addEventListener('ended', s.handleEnded);
      el.addEventListener('waiting', s.handleWaiting);
      el.addEventListener('playing', s.handlePlaying);
      el.addEventListener('error', s.handleError);
    }
    audio.volume = s.volume;
    audioB.volume = s.volume;
    return () => {
      for (const el of els) {
        el.removeEventListener('timeupdate', s.handleTimeUpdate);
        el.removeEventListener('durationchange', s.handleDurationChange);
        el.removeEventListener('ended', s.handleEnded);
        el.removeEventListener('waiting', s.handleWaiting);
        el.removeEventListener('playing', s.handlePlaying);
        el.removeEventListener('error', s.handleError);
      }
    };
  }, []);

  // ---------- restore previous queue (paused, at saved position) ----------
  useEffect(() => {
    if (!hasRestoredQueue) return undefined;
    const s = usePlayer.getState();
    const track = s.queue[s.index];
    if (!track) return undefined;
    if (s.settings.engine === 'embed') {
      // embed engine: cue it; autoplay will be blocked until the user presses play
      s._loadAndPlay(s.index, s.queue);
      usePlayer.setState({ isPlaying: false, trackLoading: false });
      s.toast('Welcome back', 'Your queue was restored — press play.');
      return undefined;
    }
    const enabledBases = new Set((s.settings.addons || []).filter((a) => a.enabled).map((a) => a.manifest?.base));
    const useAddon = Boolean(track.isAddon && track.addonBase && enabledBases.has(track.addonBase));
    const addonManifest = (s.settings.addons || []).find((a) => a.manifest?.base === track.addonBase)?.manifest || s.settings.addon?.manifest;
    // Orphan addon track with its addon disabled: do not point <audio> at an
    // invalid YouTube ID (that would fire a stream error on startup).
    if (track.isAddon && !useAddon) {
      usePlayer.getState().toast('Welcome back', 'Your addon track needs its addon — enable it in Settings to play.');
      return undefined;
    }
    audio.src = useAddon
      ? addonTrackUrl(track.addonBase, track.id, track.audioQuality || addonManifest?.defaultQuality || 'LOSSLESS')
      : streamSrc(track.id, usePlayer.getState().effectiveYtQuality || usePlayer.getState().settings?.ytQuality || 'high');
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && restorePosition > 2 && restorePosition < audio.duration - 2) {
        audio.currentTime = restorePosition;
        usePlayer.setState({ currentTime: restorePosition, duration: audio.duration });
      }
      audio.removeEventListener('loadedmetadata', onMeta);
    };
    audio.addEventListener('loadedmetadata', onMeta);
    usePlayer.getState().toast('Welcome back', 'Your queue was restored — press play.');
    return () => audio.removeEventListener('loadedmetadata', onMeta);
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- persist queue position on unload ----------
  useEffect(() => {
    const onBeforeUnload = () => {
      const s = usePlayer.getState();
      if (s.index >= 0) {
        write('cl:queue', { queue: s.queue, index: s.index, position: s.currentTime || 0 });
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') onBeforeUnload(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ---------- backend health / yt-dlp check ----------
  useEffect(() => {
    apiHealth()
      .then((h) => {
        if (!h.ytDlp) {
          usePlayer.getState().toast('yt-dlp not found', 'Audio streaming needs it — run: pip install -U yt-dlp');
        }
      })
      .catch(() => {
        usePlayer.getState().toast('Backend offline', 'Start the API server: npm run dev:server (port 3001).');
      });
  }, []);

  // ---------- shared playlist link (/share/:id) ----------
  useEffect(() => {
    const m = window.location.pathname.match(/^\/share\/([A-Za-z0-9]+)$/);
    if (!m) return undefined;
    const id = m[1];
    let cancelled = false;
    usePlayer.getState().toast('Opening shared playlist…', 'Fetching tracks from the link.');
    usePlayer.getState().openSharedPlaylist(id).then((playlist) => {
      if (cancelled) return;
      window.history.replaceState(null, '', '/');
      if (playlist) usePlayer.getState().setView({ name: 'playlist', id: playlist.id });
    });
    return () => { cancelled = true; };
  }, []);

  // ---------- online/offline + PWA install prompt (init once) ----------
  const isOnline = usePlayer((s) => s.isOnline);
  useEffect(() => {
    try { usePlayer.getState().initNetworkAdaptive?.(); } catch { /* ignore */ }
    try { usePlayer.getState().refreshOffline?.(); } catch { /* ignore */ }
    const onOnline = () => { usePlayer.setState({ isOnline: true }); usePlayer.getState().toast('Back online', 'Streaming restored.'); };
    const onOffline = () => { usePlayer.setState({ isOnline: false }); usePlayer.getState().toast('You’re offline', 'Playing downloads and local library.'); };
    const onInstall = (e) => { e.preventDefault(); setPendingInstallPrompt(e); usePlayer.getState().setInstallAvailable(true); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);

  // ---------- Listen Together polling (poll every 1.5s; host heartbeat 3s) ----------
  useEffect(() => {
    let cancelled = false;
    // subscribe to changes via interval check (cheap — poller reads store each tick)
    const pollId = setInterval(() => {
      if (cancelled) return;
      const s = usePlayer.getState();
      if (!s.together?.code) return;
      s._togetherPollOnce?.();
      if (s.together?.isHost) s._togetherPushState?.();
    }, 1500);
    // immediate tick
    setTimeout(() => { if (!cancelled) usePlayer.getState()._togetherPollOnce?.(); }, 300);
    return () => { cancelled = true; clearInterval(pollId); };
    // run once on mount; polling reads fresh state each tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- sleep timer ticker ----------
  useEffect(() => {
    const id = setInterval(() => usePlayer.getState().sleepTimerTick(), 1000);
    return () => clearInterval(id);
  }, []);

  // ---------- media session (OS lock-screen controls) ----------
  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined;
    const ms = navigator.mediaSession;
    const s = usePlayer.getState();
    try {
      if (title) {
        ms.metadata = new MediaMetadata({
          title: title || 'Chordless',
          artist: artist || 'Unknown artist',
          album: album || 'Chordless',
          artwork: thumbnail ? [
            { src: coverProxy(thumbnail), sizes: '512x512', type: 'image/jpeg' },
            { src: thumbnail, sizes: '512x512', type: 'image/jpeg' },
          ] : [],
        });
      }
      ms.playbackState = isPlaying ? 'playing' : 'paused';
      ms.setActionHandler('play', () => s.togglePlay());
      ms.setActionHandler('pause', () => s.togglePlay());
      ms.setActionHandler('previoustrack', () => s.prev());
      ms.setActionHandler('nexttrack', () => s.next(true));
      ms.setActionHandler('seekto', (d) => { if (d.seekTime != null) s.seekTo(d.seekTime); });
    } catch { /* media session unsupported in this context */ }
    return undefined;
  }, [title, artist, thumbnail, isPlaying, album]);

  // keep OS position state roughly in sync (every ~2s while playing)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return undefined;
    if (!duration || !isPlaying) return undefined;
    const id = setInterval(() => {
      try {
        navigator.mediaSession.setPositionState({ duration, position: Math.min(usePlayer.getState().currentTime || 0, duration), playbackRate: audio.playbackRate || 1 });
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(id);
  }, [duration, isPlaying]);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const typing = target instanceof HTMLElement
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      // Ctrl/Cmd + K → focus search (works even while typing)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const s = usePlayer.getState();
        s.setView({ name: 'search' });
        s.requestSearchFocus();
        return;
      }
      if (e.key === 'Escape') {
        const s = usePlayer.getState();
        if (s.karaokeOpen) { s.toggleKaraoke(false); return; }
        if (s.togetherOpen) { s.toggleTogether(false); return; }
        if (s.menu) { s.closeMenu(); return; }
        if (s.settingsOpen) { s.setSettingsOpen(false); return; }
        if (s.queueOpen) { s.toggleQueue(false); return; }
        if (s.nowPlayingOpen) { s.toggleNowPlaying(false); return; }
        return;
      }
      if (typing) return;

      const s = usePlayer.getState();
      const kb = s.settings?.keybinds || {};
      const isPlayPause = (kb.playPause || [' ', 'k']).includes(e.key) || (kb.playPause || [' ', 'k']).includes(e.key.toLowerCase());
      const isNext = (kb.next || ['n']).includes(e.key) || (kb.next || ['n']).includes(e.key.toLowerCase());
      const isPrev = (kb.prev || ['p']).includes(e.key) || (kb.prev || ['p']).includes(e.key.toLowerCase());
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          s.togglePlay();
          break;
        case 'ArrowLeft':
          if (!e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); s.skipBy(-5); }
          break;
        case 'ArrowRight':
          if (!e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); s.skipBy(5); }
          break;
        case 'ArrowUp':
          e.preventDefault();
          s.setVolume(s.volume + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          s.setVolume(s.volume - 0.05);
          break;
        case 'l': case 'L': s.toggleLyrics(); break;
        case 'c': case 'C': s.toggleKaraoke(); break;
        case 'q': case 'Q': s.toggleQueue(); break;
        case 'f': case 'F': s.toggleNowPlaying(); break;
        case 'm': case 'M': s.toggleMute(); break;
        default: break;
      }
      // Custom keybinds (Settings) override defaults above.
      if (isPlayPause && ![' ', 'k', 'K'].includes(e.key)) { e.preventDefault(); s.togglePlay(); }
      if (isNext) { s.next(true); }
      if (isPrev) { s.prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // close context menu on scroll of the main pane
  useEffect(() => {
    const main = document.querySelector('.main');
    if (!main) return undefined;
    const onScroll = () => closeMenu();
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, [closeMenu, view]);

  const mainView = useMemo(() => {
    switch (view?.name) {
      case 'home': return <HomeView />;
      case 'search': return <SearchView />;
      case 'library': return <LibraryView />;
      case 'stats': return <StatsView />;
      case 'liked': return <CollectionView />;
      case 'playlist': return <CollectionView key={view.id} playlistId={view.id} />;
      case 'ytplaylist': return <YtPlaylistView key={view.id} playlistId={view.id} />;
      case 'artist': return <ArtistView key={view.id} artistId={view.id} />;
      case 'album': return <AlbumView key={view.id} albumId={view.id} />;
      default: return <HomeView />;
    }
  }, [view]);

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}`}>
      <div className="aurora" aria-hidden="true"><span /><span /></div>
      <button className="layout-drawer-toggle" onClick={() => setNavOpen(true)} aria-label="Open navigation">
        <Menu size={22} />
      </button>
      {navOpen && <div className="nav-overlay" onClick={closeNav} aria-hidden="true" />}
      <Sidebar open={navOpen} onClose={closeNav} />
      {!isOnline && (
        <div role="status" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 99, background: 'var(--panel-strong)', border: '1px solid var(--stroke-strong)', color: 'var(--text)', padding: '8px 16px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
          You’re offline — playing downloads &amp; local library
        </div>
      )}
      <main className="main" key={view?.name + (view?.id || '')}>
        <ViewErrorBoundary>
          <Suspense fallback={<div className="empty-state" aria-busy="true"><p>Loading…</p></div>}>{mainView}</Suspense>
        </ViewErrorBoundary>
      </main>

      <EmbedEngine />
      <PlayerBar />
      <Suspense fallback={null}>
        {nowPlayingOpen && <NowPlaying />}
        {karaokeOpen && <KaraokeMode />}
        {togetherOpen && <ListenTogetherModal />}
        {queueOpen && <QueuePanel />}
      </Suspense>
      <ContextMenu />
      <Toasts />
      <Suspense fallback={null}>
        {settingsOpen && <SettingsModal />}
      </Suspense>
    </div>
  );
}
