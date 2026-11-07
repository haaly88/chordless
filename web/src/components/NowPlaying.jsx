import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1,
  ListMusic, Gauge, Check, ExternalLink, X, Mic, Volume2, VolumeX, Volume1,
  MessageSquare, Users,
  Share2, Download, Loader2,
} from 'lucide-react';
import usePlayer from '../store.js';
import { formatTime, shortQuality } from '../lib/format.js';
import SeekBar from './SeekBar.jsx';
import Visualizer from './Visualizer.jsx';
import LyricsPanel from './LyricsPanel.jsx';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function NowPlaying() {
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
  const downloadTrack = usePlayer((s) => s.downloadTrack);
  const removeOfflineTrack = usePlayer((s) => s.removeOfflineTrack);
  const isDownloaded = usePlayer((s) => (track ? s.offlineIds.includes(track.id) : false));
  const isDownloading = usePlayer((s) => (track ? s.downloadingIds.includes(track.id) : false));
  const toggleNowPlaying = usePlayer((s) => s.toggleNowPlaying);
  const lyricsOpen = usePlayer((s) => s.lyricsOpen);
  const toggleLyrics = usePlayer((s) => s.toggleLyrics);
  const toggleKaraoke = usePlayer((s) => s.toggleKaraoke);
  const toggleTogether = usePlayer((s) => s.toggleTogether);
  const gaplessStatus = usePlayer((s) => s.gaplessStatus);
  const toggleQueue = usePlayer((s) => s.toggleQueue);
  const queueOpen = usePlayer((s) => s.queueOpen);
  const playbackRate = usePlayer((s) => s.playbackRate);
  const setPlaybackRate = usePlayer((s) => s.setPlaybackRate);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const vol = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const settings = usePlayer((s) => s.settings);
  const engine = settings?.engine || 'auto';
  const effectiveYtQuality = usePlayer((s) => s.effectiveYtQuality);
  const adaptiveOn = (settings?.adaptiveQuality !== false);

  const [speedOpen, setSpeedOpen] = useState(false);
  const [visualizerFullscreen, setVisualizerFullscreen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareBlob, setShareBlob] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const speedRef = useRef(null);

  useEffect(() => {
    if (!speedOpen) return undefined;
    const onDoc = (e) => { if (!speedRef.current?.contains(e.target)) setSpeedOpen(false); };
    const onEsc = (e) => e.key === 'Escape' && setSpeedOpen(false);
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [speedOpen]);

  useEffect(() => {
    if (!shareOpen || !track) return undefined;
    let cancelled = false;
    setShareBusy(true);
    setShareUrl(null);
    generateShareCard(track, currentTime, duration).then(({ url, blob }) => {
      if (cancelled) { if (url) URL.revokeObjectURL(url); return; }
      setShareUrl(url);
      setShareBlob(blob);
      setShareBusy(false);
    }).catch(() => { if (!cancelled) setShareBusy(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareOpen, track?.id]);

  if (!track) {
    return (
      <div className="now-playing" role="dialog" aria-label="Now Playing">
        <div className="np-backdrop"><div className="np-tint" /></div>
        <button className="np-close" onClick={() => toggleNowPlaying(false)} aria-label="Close Now Playing">
          <ChevronDown size={26} />
        </button>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'rgba(255,255,255,.6)', fontSize: 16, fontWeight: 600, padding: 24, textAlign: 'center' }}>
          Nothing is playing yet. Pick a song and press play.
        </div>
      </div>
    );
  }

  const repeatLabel = repeat === 'one' ? 'Repeat this track' : repeat === 'all' ? 'Repeat all' : 'Repeat off';

  return (
    <div className={`now-playing${isPlaying ? ' is-playing' : ''}`} role="dialog" aria-modal="true" aria-label={`Now playing: ${track.title}`}>
      {/* blurred artwork backdrop with adaptive tint */}
      <div className="np-backdrop" aria-hidden="true">
        <img src={track.thumbnail} alt="" referrerPolicy="no-referrer" style={{ filter: 'blur(80px) saturate(1.5) brightness(.35)' }} />
        <div className="np-tint" />
        <div className="np-vignette" />
      </div>

      <button className="np-close" onClick={() => toggleNowPlaying(false)} aria-label="Collapse Now Playing" title="Collapse (F)">
        <ChevronDown size={26} />
      </button>

      <div className="np-body">
        {/* LEFT — large artwork */}
        <div className="np-left">
          <div className="np-art-halo" aria-hidden="true" />
          <div className="np-art-wrap">
            <img className="np-art" src={track.thumbnail} alt={`${track.title} artwork`} referrerPolicy="no-referrer" />
            <div className="np-art-overlay" />
            <div className="np-art-sheen" aria-hidden="true" />
          </div>
          <div className="np-source">
            <span className="np-source-dot" />
            <span>Playing from {engine === 'auto' ? 'Auto' : engine.charAt(0).toUpperCase() + engine.slice(1)}{!track.isAddon && adaptiveOn ? ` · Auto ${effectiveYtQuality || 'high'}` : ''}{gaplessStatus === 'preloading' ? ' · Preloading…' : gaplessStatus === 'ready' ? ' · Gapless ✓' : ''}</span>
          </div>
        </div>

        {/* RIGHT — track info + controls */}
        <div className="np-right">
          <div className="np-header">
            <h1 className="np-title">{track.title}</h1>
            <div className="np-meta">
              <span>{track.artist || 'Unknown artist'}</span>
              {track.isAddon && (
                <span className="hq-badge hq-badge-np">{shortQuality(track.audioQuality)}</span>
              )}
              {track.isLossless && (
                <span className="hq-badge hq-badge-np hq-badge-lossless">LOSSLESS</span>
              )}
              {track.isHiRes && (
                <span className="hq-badge hq-badge-np hq-badge-hires">HI-RES</span>
              )}
              {track.isDolbyAtmos && (
                <span className="hq-badge hq-badge-np hq-badge-atmos">DOLBY ATMOS</span>
              )}
              {track.isAddon && track.duration > 0 && duration > 0 && duration < track.duration * 0.6 && (
                <span className="hq-badge hq-badge-np" style={{ background: 'linear-gradient(160deg, #f59e0b, #b45309)' }} title="Addon returned a short preview, not the full track">
                  PREVIEW ~{Math.round(duration)}s
                </span>
              )}
            </div>
          </div>

          {/* current lyrics line (like BitChord) */}
          {track.syncedLyrics && (
            <div className="np-lyric-line">
              <span className="np-lyric-quote">“</span>
              <span className="np-lyric-text">{track.syncedLyrics}</span>
            </div>
          )}

          <div className="np-progress">
            <span className="np-time">{formatTime(currentTime)}</span>
            <SeekBar value={currentTime} duration={duration || 0} onSeek={(t) => seekTo(t)} ariaLabel="Seek through track" />
            <span className="np-time">{formatTime(duration)}</span>
          </div>

          <div className="np-controls">
            <button className={`icon-btn np-shuffle${shuffle ? ' active' : ''}`} onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Shuffle" title="Shuffle">
              <Shuffle size={21} />
            </button>
            <button className="icon-btn" onClick={prev} aria-label="Previous track" title="Previous">
              <SkipBack size={26} fill="rgba(255,255,255,.9)" strokeWidth={0} />
            </button>
            <button className="np-play" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
              {trackLoading
                ? <span className="spinner" style={{ borderColor: 'rgba(0,0,0,.25)', borderTopColor: '#000' }} aria-hidden="true" />
                : isPlaying ? <Pause size={29} /> : <Play size={29} style={{ marginLeft: 3 }} />}
            </button>
            <button className="icon-btn" onClick={() => next(true)} aria-label="Next track" title="Next">
              <SkipForward size={26} fill="rgba(255,255,255,.9)" strokeWidth={0} />
            </button>
            <button className={`icon-btn np-repeat${repeat !== 'off' ? ' active' : ''}`} onClick={cycleRepeat} aria-pressed={repeat !== 'off'} aria-label={repeatLabel} title={repeatLabel}>
              {repeat === 'one' ? <Repeat1 size={21} /> : <Repeat size={21} />}
            </button>
          </div>

          <div className="np-volume">
            <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
              <IconComponent volume={vol} muted={muted} />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={muted ? 0 : Math.round(vol * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="np-volume-slider"
              style={{ '--vol-fill': `${muted ? 0 : Math.round(vol * 100)}%` }}
              aria-label="Volume"
            />
            <button className="icon-btn" onClick={() => setVolume(Math.min(1, vol + 0.1))} aria-label="Volume up" title="Volume up">
              <Volume2 size={18} />
            </button>
          </div>

          <div className="np-actions">
            <button
              className={`icon-btn${liked ? ' active' : ''}`}
              style={{ color: liked ? 'var(--accent)' : 'rgba(255,255,255,.7)' }}
              onClick={() => toggleLike(track)}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike' : 'Like'}
              title={liked ? 'Unlike' : 'Like'}
            >
              <Heart size={22} fill={liked ? 'var(--accent)' : 'none'} />
            </button>

            <button
              className={`icon-btn${isDownloaded ? ' active' : ''}`}
              style={{ color: isDownloaded ? 'var(--accent)' : 'rgba(255,255,255,.7)' }}
              onClick={() => (isDownloaded ? removeOfflineTrack(track.id) : downloadTrack(track))}
              disabled={isDownloading}
              aria-pressed={isDownloaded}
              aria-label={isDownloaded ? 'Remove offline download' : 'Download for offline'}
              title={isDownloaded ? 'Downloaded — click to remove' : 'Download for offline'}
            >
              {isDownloading ? <Loader2 size={20} style={{ animation: 'spin .8s linear infinite' }} /> : <Download size={20} />}
            </button>

            <div style={{ position: 'relative' }} ref={speedRef}>
              <button className="speed-chip" onClick={() => setSpeedOpen((v) => !v)} aria-label="Playback speed" aria-expanded={speedOpen} title="Playback speed">
                <Gauge size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {playbackRate}×
              </button>
              {speedOpen && (
                <div className="menu-pop left" role="menu" aria-label="Playback speed" style={{ bottom: 'calc(100% + 10px)' }}>
                  <div className="ctx-label">SPEED</div>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      className="ctx-item"
                      role="menuitemradio"
                      aria-checked={s === playbackRate}
                      onClick={() => { setPlaybackRate(s); setSpeedOpen(false); }}
                    >
                      <span className="check-slot">{s === playbackRate && <Check size={15} strokeWidth={3} />}</span>
                      {s}×{s === 1 ? ' (normal)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className={`icon-btn${lyricsOpen ? ' active' : ''}`}
              style={{ color: lyricsOpen ? 'var(--accent)' : 'rgba(255,255,255,.7)' }}
              onClick={() => toggleLyrics()}
              aria-pressed={lyricsOpen}
              aria-label="Toggle lyrics"
              title="Lyrics"
            >
              <Mic size={20} />
            </button>

            <button
              className="icon-btn"
              style={{ color: 'rgba(255,255,255,.7)' }}
              onClick={() => toggleKaraoke(true)}
              aria-label="Karaoke mode"
              title="Karaoke mode (C)"
            >
              <MessageSquare size={20} />
            </button>

            <button
              className="icon-btn"
              style={{ color: 'rgba(255,255,255,.7)' }}
              onClick={() => toggleTogether(true)}
              aria-label="Listen Together"
              title="Listen Together"
            >
              <Users size={20} />
            </button>

            <button
              className={`icon-btn${queueOpen ? ' active' : ''}`}
              style={{ color: queueOpen ? 'var(--accent)' : 'rgba(255,255,255,.7)' }}
              onClick={() => toggleQueue()}
              aria-pressed={queueOpen}
              aria-label="Toggle queue"
              title="Queue (Q)"
            >
              <ListMusic size={22} />
            </button>

            <button
              className={`icon-btn${shareOpen ? ' active' : ''}`}
              style={{ color: shareOpen ? 'var(--accent)' : 'rgba(255,255,255,.7)' }}
              onClick={() => setShareOpen(true)}
              aria-pressed={shareOpen}
              aria-label="Share Now Playing card"
              title="Share card (PNG)"
            >
              <Share2 size={20} />
            </button>

            <button
              className={`icon-btn${visualizerFullscreen ? ' active' : ''}`}
              onClick={() => setVisualizerFullscreen((v) => !v)}
              aria-pressed={visualizerFullscreen}
              aria-label={visualizerFullscreen ? 'Exit fullscreen visualizer' : 'Fullscreen visualizer'}
              title={visualizerFullscreen ? 'Exit fullscreen visualizer' : 'Fullscreen visualizer'}
            >
              {visualizerFullscreen ? <X size={20} /> : <ExternalLink size={20} />}
            </button>
          </div>
        </div>
      </div>

      {visualizerFullscreen && (
        <div className="np-vs-overlay" onClick={() => setVisualizerFullscreen(false)}>
          <Visualizer className="np-vs-canvas" />
          <div className="np-vs-hint">Tap to exit fullscreen visualizer</div>
          <button className="np-vs-close" onClick={() => setVisualizerFullscreen(false)} aria-label="Exit fullscreen visualizer">
            <X size={24} />
          </button>
        </div>
      )}

      {shareOpen && (
        <div className="modal-backdrop" onClick={() => setShareOpen(false)} role="presentation" style={{ zIndex: 90 }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Share Now Playing card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Share card</h2>
              <button className="icon-btn" onClick={() => setShareOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="share-card-preview">
              {shareBusy ? (
                <div style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', color: 'var(--text-2)', gap: 10 }}>
                  <Loader2 size={30} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13 }}>Rendering card…</span>
                </div>
              ) : shareUrl ? (
                <img src={shareUrl} alt={`Share card for ${track.title}`} />
              ) : (
                <div style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                  Could not render the card. Check connection and try again.
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setShareOpen(false)}>Close</button>
              <button
                className="btn"
                disabled={!shareBlob || shareBusy}
                onClick={async () => {
                  if (!shareBlob) return;
                  const file = new File([shareBlob], `${track.title} — ${track.artist || 'Unknown'}.png`, { type: 'image/png' });
                  if (navigator.canShare?.({ files: [file] })) {
                    try { await navigator.share({ files: [file], title: track.title }); } catch { /* user cancelled */ }
                  } else {
                    try {
                      await navigator.clipboard.write([new ClipboardItem({ 'image/png': shareBlob })]);
                      alert('Card copied — paste it anywhere.');
                    } catch {
                      alert('Sharing is not available in this browser. Use Download instead.');
                    }
                  }
                }}
              >
                <Share2 size={15} /> Share / Copy
              </button>
              <a
                className={`btn primary${shareUrl ? '' : ' disabled'}`}
                style={shareUrl ? undefined : { opacity: .5, pointerEvents: 'none' }}
                href={shareUrl || '#'}
                download={`${track.title} — ${track.artist || 'Unknown'}.png`}
                onClick={(e) => { if (!shareUrl) e.preventDefault(); }}
              >
                <Download size={15} /> Download PNG
              </a>
            </div>
          </div>
        </div>
      )}

      {/* right — lyrics panel (only when opened via button) */}
      {lyricsOpen && <LyricsPanel track={track} />}
    </div>
  );
}

function IconComponent({ volume, muted }) {
  if (muted || volume === 0) return <VolumeX size={18} />;
  if (volume < 0.5) return <Volume1 size={18} />;
  return <Volume2 size={18} />;
}

/* ---------- share card (Canvas 1080×1080) ---------- */

function loadPreviewImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
    setTimeout(() => finish(null), 8000);
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, size, radius) {
  ctx.save();
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.clip();
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  ctx.restore();
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      if (lines.length >= maxLines) break;
      line = word;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && ctx.measureText(lines[maxLines - 1]).width > maxWidth) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trim()}…`;
  }
  return lines;
}

async function generateShareCard(track, currentTime = 0, duration = 0) {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  // base
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#0b0b10');
  bg.addColorStop(1, '#15151f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  const img = await loadPreviewImage(track.thumbnail);
  if (img) {
    ctx.save();
    ctx.filter = 'blur(70px) brightness(.42) saturate(1.5)';
    const coverW = S + 200;
    const coverH = S + 200;
    const scale = Math.max(coverW / img.width, coverH / img.height);
    ctx.drawImage(img, (S - img.width * scale) / 2, (S - img.height * scale) / 2, img.width * scale, img.height * scale);
    ctx.restore();
    ctx.fillStyle = 'rgba(5,5,10,.28)';
    ctx.fillRect(0, 0, S, S);
  } else {
    const glow = ctx.createRadialGradient(S / 2, 300, 60, S / 2, 300, 520);
    glow.addColorStop(0, 'rgba(124,92,255,.32)');
    glow.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, S, S);
  }

  // artwork card
  const art = 520;
  const artX = (S - art) / 2;
  const artY = 92;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#1e1e2a';
  roundRectPath(ctx, artX, artY, art, art, 36);
  ctx.fill();
  ctx.restore();
  if (img) {
    drawCover(ctx, img, artX, artY, art, 36);
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.font = '400 180px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', S / 2, artY + art / 2 + 8);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, artX, artY, art, art, 36);
  ctx.stroke();

  // titles
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const titleY = artY + art + 84;
  ctx.fillStyle = '#fff';
  ctx.font = '800 58px "Segoe UI", Inter, system-ui, sans-serif';
  const titleLines = wrapLines(ctx, track.title || 'Untitled', S - 180, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, S / 2, titleY + i * 68));

  const artistY = titleY + titleLines.length * 68 + 6;
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.font = '500 36px "Segoe UI", Inter, system-ui, sans-serif';
  const artistLines = wrapLines(ctx, track.artist || 'Unknown artist', S - 220, 1);
  artistLines.forEach((line) => ctx.fillText(line, S / 2, artistY));

  let cursorY = artistY + 52;
  if (track.syncedLyrics) {
    ctx.fillStyle = 'rgba(216,180,254,.95)';
    ctx.font = 'italic 500 30px "Segoe UI", Inter, system-ui, sans-serif';
    const lyricLines = wrapLines(ctx, `“${track.syncedLyrics}”`, S - 260, 2);
    lyricLines.forEach((line, i) => ctx.fillText(line, S / 2, cursorY + i * 42));
    cursorY += lyricLines.length * 42 + 14;
  }

  // progress bar (snapshot at share time)
  if (duration > 0) {
    const barW = 520;
    const barX = (S - barW) / 2;
    const barY = cursorY + 46;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.arc(barX, barY, 5, 0, Math.PI * 2);
    ctx.arc(barX + barW, barY, 5, 0, Math.PI * 2);
    ctx.rect(barX, barY - 5, barW, 10);
    ctx.fill();
    const fillW = Math.max(14, Math.min(barW, (currentTime / duration) * barW));
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath();
    roundRectPath(ctx, barX, barY, fillW, 9, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '600 24px "Segoe UI", Inter, system-ui, sans-serif';
    ctx.fillText('●  NOW PLAYING', S / 2, barY + 48);
  }

  // footer
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = '700 26px "Segoe UI", Inter, system-ui, sans-serif';
  ctx.fillText('♪  SHARED FROM CHORDLESS  ♪', S / 2, S - 54);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { url: blob ? URL.createObjectURL(blob) : null, blob };
}
