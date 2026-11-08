import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Minus, Plus, RotateCcw, Globe, ChevronDown, Check, Music, AlertCircle, RefreshCw, Mic } from 'lucide-react';
import usePlayer from '../store.js';
import { apiLyrics } from '../lib/api.js';
import { parseLrc, activeLineIndex } from '../lib/lrc.js';
import { formatTime } from '../lib/format.js';
import SeekBar from './SeekBar.jsx';

const LANG_OPTIONS = [
  { code: 'id', label: 'Indonesian', flag: '🇮🇩' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { code: 'th', label: 'Thai', flag: '🇹🇭' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'ms', label: 'Malay', flag: '🇲🇾' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
];

export default function KaraokeMode() {
  const track = usePlayer((s) => (s.index >= 0 && s.queue[s.index]) || null);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seekTo = usePlayer((s) => s.seekTo);
  const toggleKaraoke = usePlayer((s) => s.toggleKaraoke);
  const offset = usePlayer((s) => s.lyricsOffset);
  const setLyricsOffset = usePlayer((s) => s.setLyricsOffset);
  const karaokeFontSize = usePlayer((s) => s.karaokeFontSize);
  const setKaraokeFontSize = usePlayer((s) => s.setKaraokeFontSize);
  const lyricsTranslation = usePlayer((s) => s.lyricsTranslation);
  const lyricsTargetLang = usePlayer((s) => s.lyricsTargetLang);
  const toggleLyricsTranslation = usePlayer((s) => s.toggleLyricsTranslation);
  const setLyricsTargetLang = usePlayer((s) => s.setLyricsTargetLang);
  const translatedLyrics = usePlayer((s) => s.translatedLyrics);
  const translateLyrics = usePlayer((s) => s.translateLyrics);
  const clearTranslatedLyrics = usePlayer((s) => s.clearTranslatedLyrics);

  const [state, setState] = useState({ status: 'idle', data: null, message: null });
  const [retryTick, setRetryTick] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);
  const scrollRef = useRef(null);
  const lineRefs = useRef([]);
  const suspendUntil = useRef(0);

  useEffect(() => {
    if (!langOpen) return undefined;
    const onDoc = (e) => { if (!langRef.current?.contains(e.target)) setLangOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setLangOpen(false); } };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [langOpen]);

  const payload = state.data;

  useEffect(() => {
    if (!track?.id) return undefined;
    const controller = new AbortController();
    const effectiveDuration = duration && duration > 0 ? duration : track?.duration;
    setState({ status: 'loading', data: null, message: null });
    apiLyrics({ artist: track.artist, track: track.title, album: track.album, duration: effectiveDuration }, { signal: controller.signal })
      .then((data) => setState({ status: 'ready', data, message: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ status: 'error', data: null, message: err.message || 'Failed to load lyrics' });
      });
    return () => controller.abort();
  }, [track?.id, track?.title, track?.artist, track?.album, Math.round(duration || 0), retryTick]);

  useEffect(() => {
    if (!lyricsTranslation || (!payload?.syncedLyrics && !payload?.plainLyrics)) {
      clearTranslatedLyrics();
      return undefined;
    }
    const cleanText = payload.syncedLyrics ? parseLrc(payload.syncedLyrics).map((l) => l.text).join('\n') : (payload.plainLyrics || '');
    if (!cleanText.trim()) return () => clearTranslatedLyrics();
    translateLyrics(cleanText);
    return () => clearTranslatedLyrics();
  }, [payload, lyricsTranslation, lyricsTargetLang, translateLyrics, clearTranslatedLyrics]);

  const syncedLines = useMemo(() => (payload?.syncedLyrics ? parseLrc(payload.syncedLyrics) : []), [payload?.syncedLyrics]);
  const activeIndex = useMemo(
    () => (syncedLines.length ? activeLineIndex(syncedLines, currentTime + offset) : -1),
    [syncedLines, currentTime, offset],
  );

  useEffect(() => {
    if (activeIndex < 0) return;
    if (Date.now() < suspendUntil.current) return;
    const line = lineRefs.current[activeIndex];
    if (line) line.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  const suspend = () => { suspendUntil.current = Date.now() + 2500; };
  const currentLang = LANG_OPTIONS.find((o) => o.code === lyricsTargetLang) || LANG_OPTIONS[0];

  const sizeClass = karaokeFontSize === 'xl' ? 'xl' : karaokeFontSize === 'normal' ? 'normal' : 'large';

  // per-line progress for the active karaoke line
  const lineProgress = (i) => {
    if (i !== activeIndex || !syncedLines.length) return 0;
    const cur = syncedLines[i];
    const nxt = syncedLines[i + 1];
    const span = (nxt ? nxt.time : (duration || cur.time + 5)) - cur.time;
    if (span <= 0) return 1;
    return Math.max(0, Math.min(1, (currentTime + offset - cur.time) / span));
  };

  if (!track) {
    return (
      <div className="karaoke-overlay" role="dialog" aria-label="Karaoke">
        <div className="karaoke-back" aria-hidden="true" />
        <div style={{ position: 'relative', zIndex: 2, display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
          <div>
            <Mic size={36} />
            <p style={{ color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>Pick a song first to sing along.</p>
            <button className="btn" onClick={() => toggleKaraoke(false)}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="karaoke-overlay" role="dialog" aria-modal="true" aria-label={`Karaoke: ${track.title}`}>
      <div className="karaoke-back" aria-hidden="true">
        <img src={track.thumbnail} alt="" referrerPolicy="no-referrer" />
        <div className="karaoke-tint" />
      </div>

      <header className="karaoke-head">
        <button className="icon-btn karaoke-close" onClick={() => toggleKaraoke(false)} aria-label="Exit karaoke" title="Exit (Esc)"><X size={24} /></button>
        <div className="karaoke-head-meta">
          <img src={track.thumbnail} alt="" referrerPolicy="no-referrer" />
          <div>
            <b>{track.title}</b>
            <span>{track.artist || 'Unknown artist'}</span>
          </div>
        </div>
        <div className="karaoke-head-tools">
          <div className="segmented karaoke-size" role="radiogroup" aria-label="Lyric size">
            {['normal', 'large', 'xl'].map((sz) => (
              <button key={sz} role="radio" aria-checked={karaokeFontSize === sz} className={karaokeFontSize === sz ? 'active' : ''} onClick={() => setKaraokeFontSize(sz)}>
                {sz === 'normal' ? 'A' : sz === 'large' ? 'A+' : 'A++'}
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={() => setLyricsOffset(Math.round((offset - 0.5) * 10) / 10)} title="Lyrics earlier" aria-label="Lyrics earlier"><Minus size={15} /></button>
          <span style={{ fontSize: 12, minWidth: 44, textAlign: 'center' }}>{offset >= 0 ? `+${offset.toFixed(1)}` : offset.toFixed(1)}s</span>
          <button className="icon-btn" onClick={() => setLyricsOffset(Math.round((offset + 0.5) * 10) / 10)} title="Lyrics later" aria-label="Lyrics later"><Plus size={15} /></button>
          <button className="icon-btn" onClick={() => setLyricsOffset(0)} title="Reset offset" aria-label="Reset offset"><RotateCcw size={14} /></button>
          <button className={`icon-btn${lyricsTranslation ? ' active' : ''}`} onClick={toggleLyricsTranslation} aria-pressed={lyricsTranslation} title="Translate" aria-label="Translate"><Globe size={16} /></button>
          {lyricsTranslation && (
            <div className="lang-wrap" ref={langRef}>
              <button className="lang-trigger" onClick={() => setLangOpen((v) => !v)} aria-expanded={langOpen} title="Translation language">
                <span className="lang-flag">{currentLang.flag}</span><span className="lang-code">{currentLang.code.toUpperCase()}</span><ChevronDown size={13} className={langOpen ? 'lang-chev open' : 'lang-chev'} />
              </button>
              {langOpen && (
                <div className="lang-menu" role="menu" aria-label="Translation language">
                  <div className="ctx-label">TRANSLATE TO</div>
                  <div className="lang-list">
                    {LANG_OPTIONS.map((o) => (
                      <button key={o.code} className={`lang-item${o.code === lyricsTargetLang ? ' active' : ''}`} role="menuitemradio" aria-checked={o.code === lyricsTargetLang} onClick={() => { setLyricsTargetLang(o.code); setLangOpen(false); }}>
                        <span className="lang-flag">{o.flag}</span><span className="lang-name">{o.label}</span><span className="lang-check">{o.code === lyricsTargetLang && <Check size={15} strokeWidth={3} />}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="karaoke-body">
        {state.status === 'loading' && (
          <div className="karaoke-status"><span className="spinner" aria-hidden="true" /> Loading lyrics…</div>
        )}
        {state.status === 'error' && (
          <div className="karaoke-status"><AlertCircle size={30} /><b>Couldn’t load lyrics</b><small>{state.message}</small><button className="btn" onClick={() => setRetryTick((n) => n + 1)}><RefreshCw size={15} /> Try again</button></div>
        )}
        {state.status === 'ready' && payload && !payload.found && (
          <div className="karaoke-status"><Mic size={30} /><b>No lyrics found</b><small>LRCLIB doesn’t have this track yet.</small></div>
        )}
        {state.status === 'ready' && payload?.instrumental && (
          <div className="karaoke-status"><Music size={32} /><b>Instrumental</b><small>No vocals — enjoy the notes.</small></div>
        )}
        {syncedLines.length > 0 && (
          <div className={`karaoke-scroll ${sizeClass}`} ref={scrollRef} onWheel={suspend} onTouchMove={suspend} aria-label="Karaoke lyrics">
            {syncedLines.map((line, i) => {
              const isActive = i === activeIndex;
              const prog = lineProgress(i);
              const translated = translatedLyrics?.translated;
              const tLine = translated && lyricsTranslation ? (translated.split('\n')[i] || '') : '';
              return (
                <button
                  key={`${i}-${line.time}`}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  className={`karaoke-line${isActive ? ' active' : ''}${!line.text ? ' empty' : ''}`}
                  style={isActive && line.text ? { '--kp': `${Math.round(prog * 100)}%` } : undefined}
                  onClick={() => line.text && seekTo(Math.max(0, line.time - offset))}
                  aria-current={isActive ? 'true' : undefined}
                  disabled={!line.text}
                >
                  <span className="karaoke-text" data-text={line.text || '♪'}>{line.text || '♪'}</span>
                  {tLine && lyricsTranslation && <span className="karaoke-sub">{tLine}</span>}
                </button>
              );
            })}
          </div>
        )}
        {syncedLines.length === 0 && payload?.plainLyrics && (
          <div className={`karaoke-scroll ${sizeClass}`} onWheel={suspend} onTouchMove={suspend}>
            <div className="karaoke-plain">{payload.plainLyrics}</div>
            {translatedLyrics?.translated && lyricsTranslation && <div className="karaoke-plain-sub">{translatedLyrics.translated}</div>}
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: 11, letterSpacing: '.18em', padding: '20px 0' }}>PLAIN LYRICS · NOT SYNCED</div>
          </div>
        )}
      </div>

      <footer className="karaoke-foot">
        <div className="karaoke-progress">
          <span>{formatTime(currentTime)}</span>
          <SeekBar value={currentTime} duration={duration || 0} onSeek={(t) => seekTo(t)} ariaLabel="Seek through track" />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="karaoke-controls">
          <button className="icon-btn" onClick={prev} aria-label="Previous"><SkipBack size={24} /></button>
          <button className="karaoke-play" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={26} /> : <Play size={26} style={{ marginLeft: 2 }} />}</button>
          <button className="icon-btn" onClick={() => next(true)} aria-label="Next"><SkipForward size={24} /></button>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>C exits · Esc closes · tap a line to seek</div>
      </footer>
    </div>
  );
}
