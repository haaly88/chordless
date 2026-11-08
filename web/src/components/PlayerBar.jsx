import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Heart, Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1,
  Mic, ListMusic, Moon, ChevronUp, ChevronDown, Volume2, VolumeX, Volume1, Check, ListPlus, MoreVertical, Clock, Users, MessageSquare,
} from 'lucide-react';
import usePlayer from '../store.js';
import { formatTime, formatTotalDuration } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { parseLrc, activeLineIndex } from '../lib/lrc.js';
import SeekBar from './SeekBar.jsx';
import Visualizer from './Visualizer.jsx';

const SLEEP_OPTIONS = [
  { label: 'Off', value: null },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes', value: 60 },
  { label: 'End of this track', value: 'track' },
];

function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const effective = muted ? 0 : volume;

  const fracFromEvent = (clientX) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const Icon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="vol-slider">
      <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
        <Icon size={19} />
      </button>
      <div
        ref={trackRef}
        className="vol-track"
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(effective * 100)}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setVolume(fracFromEvent(e.clientX));
        }}
        onPointerMove={(e) => dragging && setVolume(fracFromEvent(e.clientX))}
        onPointerUp={(e) => { setDragging(false); e.currentTarget.releasePointerCapture?.(e.pointerId); }}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          // Adjust the STORED level (not the muted display value) so arrow
          // keys never clobber volume to 0 / jump to 5% while muted.
          if (e.key === 'ArrowLeft') { e.preventDefault(); setVolume(Math.max(0, volume - 0.05)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setVolume(Math.min(1, volume + 0.05)); }
        }}
      >
        <div className="vol-fill" style={{ width: `${effective * 100}%` }} />
      </div>
    </div>
  );
}

function SleepMenu() {
  const sleepTimer = usePlayer((s) => s.sleepTimer);
  const setSleepTimer = usePlayer((s) => s.setSleepTimer);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (typeof sleepTimer !== 'number') return undefined;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [sleepTimer]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const active = sleepTimer != null;
  const currentValue = sleepTimer === 'track' ? 'track' : null;
  const remaining = typeof sleepTimer === 'number' ? Math.max(0, Math.ceil((sleepTimer - Date.now()) / 1000)) : null;
  const remainingLabel = remaining != null ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : null;

  return (
    <div className="pb-sleep-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }} ref={ref}>
      <button
        className={`icon-btn${active ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Sleep timer"
        aria-expanded={open}
        title={active ? 'Sleep timer is set' : 'Sleep timer'}
      >
        <Moon size={19} />
      </button>
      {remainingLabel && (
        <button
          className="pill"
          onClick={() => setSleepTimer(null)}
          title={`Sleep timer — ${remainingLabel} left. Click to cancel.`}
          aria-label={`Sleep timer ${remainingLabel} left, click to cancel`}
          style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11.5, padding: '4px 10px' }}
        >
          {remainingLabel} ×
        </button>
      )}
      {open && (
        <div className="menu-pop" role="menu" aria-label="Sleep timer options">
          <div className="ctx-label">SLEEP TIMER</div>
          {SLEEP_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className="ctx-item"
              role="menuitemradio"
              aria-checked={opt.value === currentValue || (opt.value === null && sleepTimer === null)}
              onClick={() => { setSleepTimer(opt.value); setOpen(false); }}
            >
              <span className="check-slot">
                {(opt.value === currentValue || (opt.value === null && sleepTimer === null)) && <Check size={15} strokeWidth={3} />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlayerBar() {
  const track = usePlayer((s) => (s.index >= 0 && s.queue[s.index]) || null);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const trackLoading = usePlayer((s) => s.trackLoading);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seekTo = usePlayer((s) => s.seekTo);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const liked = usePlayer((s) => (track ? s.liked.some((t) => t.id === track.id) : false));
  const toggleLike = usePlayer((s) => s.toggleLike);
  const toggleNowPlaying = usePlayer((s) => s.toggleNowPlaying);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const toggleQueue = usePlayer((s) => s.toggleQueue);
  const lyricsOpen = usePlayer((s) => s.lyricsOpen);
  const toggleLyrics = usePlayer((s) => s.toggleLyrics);
  const toggleKaraoke = usePlayer((s) => s.toggleKaraoke);
  const toggleTogether = usePlayer((s) => s.toggleTogether);
  const together = usePlayer((s) => s.together);
  const queueLength = usePlayer((s) => s.queue.length);
  const nextTrack = usePlayer((s) => {
    const q = s.queue; const idx = s.index;
    if (!q?.length || idx < 0) return null;
    if (idx + 1 < q.length) return q[idx + 1];
    if (s.repeat === 'all') return q[0];
    return null;
  });
  const queueDurationFormatted = usePlayer((s) => s.queueDurationFormatted());
  const addToQueue = usePlayer((s) => s.addToQueue);
  const openMenu = usePlayer((s) => s.openMenu);
  const miniPlayer = usePlayer((s) => s.miniPlayer);
  const toggleMiniPlayer = usePlayer((s) => s.toggleMiniPlayer);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  const nextTitle = nextTrack ? `${t(lang, 'player.next')}: ${nextTrack.title || ''}` : t(lang, 'player.next');
  const lyricsOffset = usePlayer((s) => s.lyricsOffset);
  const [miniLyric, setMiniLyric] = useState('');

  useEffect(() => {
    if (!track?.id || !lyricsOpen) { setMiniLyric(''); return undefined; }
    let cancelled = false;
    let timer = null;
    (async () => {
      try {
        const all = JSON.parse(localStorage.getItem('cl:lyricsCache') || '{}');
        const data = all?.[track.id]?.data;
        if (cancelled || !data?.syncedLyrics) return;
        const lines = parseLrc(data.syncedLyrics);
        if (!lines.length) return;
        const tick = () => {
          try {
            const tNow = usePlayer.getState().currentTime + (usePlayer.getState().lyricsOffset || 0);
            const idx = activeLineIndex(lines, tNow);
            setMiniLyric(lines[idx]?.text || '');
          } catch { /* ignore */ }
        };
        tick();
        timer = setInterval(tick, 300);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [track?.id, lyricsOpen]);

  const repeatLabel = repeat === 'one' ? t(lang, 'player.repeat') : repeat === 'all' ? t(lang, 'player.repeat') : t(lang, 'player.repeat');

  // Marquee seam fix: lock the title box to the FIRST copy's width, so the
  // second copy (which follows it for the seamless loop) can never peek in
  // when the box happens to be wider than the title ("ghost title").
  const titleRef = useRef(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const span = el.querySelector('.pb-marquee > span');
    if (!span) return;
    const avail = el.parentElement?.clientWidth || span.offsetWidth;
    el.style.width = `${Math.min(span.offsetWidth, avail)}px`;
  }, [track?.title]);

  return (
    <>
      {miniLyric && (
        <div aria-live="polite" style={{ position: 'fixed', left: '50%', bottom: 'calc(var(--player-h) + 8px)', transform: 'translateX(-50%)', zIndex: 39, maxWidth: 'min(560px, 86vw)', background: 'var(--panel-strong)', border: '1px solid var(--stroke-strong)', color: 'var(--text)', padding: '6px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {miniLyric}
        </div>
      )}
    <footer className={`player-bar${miniPlayer ? ' mini' : ''}${isPlaying ? ' is-playing' : ''}`} aria-label="Now playing bar">
      {/* left — artwork & meta */}
      <div className="pb-left">
        {track ? (
          <>
            <img
              className="pb-art"
              src={track.thumbnail}
              alt={`${track.title} artwork`}
              onClick={() => toggleNowPlaying(true)}
              referrerPolicy="no-referrer"
              title="Open Now Playing"
            />
            <div className="pb-meta">
              <div className="pb-title" ref={titleRef} onClick={() => toggleNowPlaying(true)} role="button" tabIndex={0}
                   onKeyDown={(e) => e.key === 'Enter' && toggleNowPlaying(true)}>
                {track.title.length > 18 ? (
                  <span className="pb-marquee" aria-label={track.title}>
                    <span>{track.title}</span><span aria-hidden="true">{track.title}</span>
                  </span>
                ) : track.title}
              </div>
              <div className="pb-artist">{track.artist || 'Unknown artist'}</div>
            </div>
            {!miniPlayer && <Visualizer className="pb-mini-viz" bars={18} />}
            <button
              className={`icon-btn like-btn${liked ? ' liked' : ''}`}
              onClick={() => toggleLike(track)}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              title={liked ? 'Unlike' : 'Like'}
            >
              <Heart size={19} />
            </button>
            <button
              className="icon-btn pb-plus"
              onClick={() => addToQueue(track)}
              aria-label="Add to queue"
              title="Add to queue"
            >
              <ListPlus size={19} />
            </button>
            <button
              className="icon-btn pb-more"
              onClick={(e) => openMenu({ x: e.clientX, y: e.clientY, track, contextList: undefined })}
              aria-label="More options"
              title="More options"
            >
              <MoreVertical size={19} />
            </button>
          </>
        ) : (
          <div className="pb-meta"><div className="pb-artist">Nothing playing — pick a song.</div></div>
        )}
      </div>

      {/* center — transport + progress (hidden in mini mode) */}
      {!miniPlayer && (
        <div className="pb-center">
          <div className="pb-controls">
            <button className={`icon-btn${shuffle ? ' active' : ''}`} onClick={toggleShuffle} aria-pressed={shuffle} aria-label={t(lang, 'player.shuffle')} title={t(lang, 'player.shuffle')}>
              <Shuffle size={18} />
            </button>
            <button className="icon-btn" onClick={prev} aria-label={t(lang, 'player.prev')} title={t(lang, 'player.prev')}>
              <SkipBack size={21} fill="currentColor" strokeWidth={0} />
            </button>
            <button
              className={`pb-play${trackLoading ? ' is-loading' : ''}`}
              onClick={togglePlay}
              aria-label={isPlaying ? t(lang, 'player.pause') : t(lang, 'player.play')}
              title={isPlaying ? t(lang, 'player.pause') : t(lang, 'player.play')}
              disabled={!track}
            >
              {trackLoading ? <span className="spinner" aria-hidden="true" /> : isPlaying
                ? <Pause size={19} />
                : <Play size={19} style={{ marginLeft: 2 }} />}
            </button>
            <button className="icon-btn" onClick={() => next(true)} aria-label={t(lang, 'player.next')} title={nextTitle}>
              <SkipForward size={21} fill="currentColor" strokeWidth={0} />
            </button>
            <button className={`icon-btn${repeat !== 'off' ? ' active' : ''}`} onClick={cycleRepeat} aria-pressed={repeat !== 'off'} aria-label={repeatLabel} title={repeatLabel}>
              {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>
          <div className="pb-progress">
            <span className="pb-time">{formatTime(currentTime)}</span>
            <SeekBar value={currentTime} duration={duration || 0} onSeek={(t) => seekTo(t)} ariaLabel="Seek through track" />
            <span className="pb-time">{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* right — lyrics, karaoke, together, queue badge + up-next, sleep, volume, expand / mini */}
      <div className="pb-right">
        <button
          className={`icon-btn${lyricsOpen ? ' active' : ''}`}
          onClick={() => toggleLyrics()}
          aria-pressed={lyricsOpen}
          aria-label="Toggle lyrics"
          title="Lyrics (L)"
        >
          <Mic size={19} />
        </button>
        <button
          className="icon-btn pb-karaoke-btn"
          onClick={() => toggleKaraoke(true)}
          aria-label="Karaoke mode"
          title="Karaoke mode (C)"
        >
          <MessageSquare size={19} />
        </button>
        <button
          className={`icon-btn${together?.code ? ' active' : ''}`}
          onClick={() => toggleTogether(true)}
          aria-label="Listen Together"
          title={together?.code ? `Together · ${together.code}` : 'Listen Together'}
          style={{ position: 'relative' }}
        >
          <Users size={19} />
          {together?.code && (together.members?.length || 0) > 0 && (
            <span className="pb-queue-badge">{together.members.length > 99 ? '99+' : together.members.length}</span>
          )}
        </button>
        <div className="pb-queue-wrap">
          <button
            className={`icon-btn${queueOpen ? ' active' : ''}`}
            onClick={() => toggleQueue()}
            aria-pressed={queueOpen}
            aria-label="Toggle queue"
            title="Queue (Q)"
          >
            <ListMusic size={20} />
            {queueLength > 0 && (
              <span className="pb-queue-badge">{queueLength > 99 ? '99+' : queueLength}</span>
            )}
          </button>
        </div>
        {track && queueLength > 0 && !miniPlayer && queueDurationFormatted && (
          <div className="pb-queue-info">
            <Clock size={13} style={{ verticalAlign: '-1px', marginRight: 6 }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 600 }}>
              {queueLength} {queueLength === 1 ? 'track' : 'tracks'} · {queueDurationFormatted}
            </span>
          </div>
        )}
        <SleepMenu />
        <VolumeControl />
        <button
          className="icon-btn"
          onClick={toggleMiniPlayer}
          aria-label={miniPlayer ? t(lang, 'player.expand') : t(lang, 'player.collapse')}
          title={miniPlayer ? t(lang, 'player.expand') : t(lang, 'player.collapse')}
        >
          {miniPlayer ? <ChevronUp size={21} /> : <ChevronDown size={21} />}
        </button>
        <button className="icon-btn" onClick={() => toggleNowPlaying(true)} aria-label={t(lang, 'player.openNow')} title={t(lang, 'player.openNow')}>
          <ChevronUp size={21} />
        </button>
      </div>
    </footer>
    </>
  );
}
