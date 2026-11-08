import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Minus, Plus, Music, LocateFixed, RotateCcw, AlertCircle, RefreshCw, Globe, ChevronDown, Check, Download } from 'lucide-react';
import usePlayer from '../store.js';
import { apiLyrics } from '../lib/api.js';
import { parseLrc, activeLineIndex } from '../lib/lrc.js';
import { formatTime } from '../lib/format.js';
import { t } from '../lib/i18n.js';

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

/**
 * Synced lyrics panel — LRCLIB, Apple-Music-style: large bold lines,
 * the active line lights up and scales, auto-scroll follows (suspended
 * when the user scrolls manually, with a "jump to current line" button),
 * click any line to seek. Plain / instrumental / missing states handled.
 */
export default function LyricsPanel({ track }) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const seekTo = usePlayer((s) => s.seekTo);
  const offset = usePlayer((s) => s.lyricsOffset);
  const setLyricsOffset = usePlayer((s) => s.setLyricsOffset);
  const lyricsTranslation = usePlayer((s) => s.lyricsTranslation);
  const lyricsTargetLang = usePlayer((s) => s.lyricsTargetLang);
  const toggleLyricsTranslation = usePlayer((s) => s.toggleLyricsTranslation);
  const setLyricsTargetLang = usePlayer((s) => s.setLyricsTargetLang);
  const translatedLyrics = usePlayer((s) => s.translatedLyrics);
  const translateLyrics = usePlayer((s) => s.translateLyrics);
  const clearTranslatedLyrics = usePlayer((s) => s.clearTranslatedLyrics);
  const lang = usePlayer((s) => s.settings.lang || 'en');

  const [state, setState] = useState({ status: 'idle', data: null, message: null });
  const [retryTick, setRetryTick] = useState(0);
  const [suspended, setSuspended] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);
  const scrollRef = useRef(null);
  const lineRefs = useRef([]);
  const suspendUntil = useRef(0);
  const resumeTimer = useRef(0);

  useEffect(() => {
    if (!langOpen) return undefined;
    const onDoc = (e) => { if (!langRef.current?.contains(e.target)) setLangOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setLangOpen(false); } };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [langOpen]);

  const payload = state.data;

  // fetch lyrics when the track changes, and re-fetch once the real
  // audio duration is known (LRCLIB matches most reliably on duration)
  useEffect(() => {
    if (!track?.id) return undefined;
    const controller = new AbortController();
    const effectiveDuration = duration && duration > 0 ? duration : track?.duration;
    setState({ status: 'loading', data: null, message: null });
    const readCache = () => {
      // Single capped index (50 entries) — never per-track keys.
      try {
        const all = JSON.parse(localStorage.getItem('cl:lyricsCache') || '{}');
        return all?.[track.id]?.data ? all[track.id] : null;
      } catch { return null; }
    };
    const writeCache = (data) => {
      try {
        const all = JSON.parse(localStorage.getItem('cl:lyricsCache') || '{}');
        all[track.id] = { data, at: Date.now() };
        const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 50);
        localStorage.setItem('cl:lyricsCache', JSON.stringify(Object.fromEntries(entries)));
      } catch { /* full/blocked */ }
    };
    apiLyrics({ artist: track.artist, track: track.title, album: track.album, duration: effectiveDuration }, { signal: controller.signal })
      .then((data) => { writeCache(data); setState({ status: 'ready', data, message: null }); })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        const cached = readCache()?.data;
        if (cached) {
          setState({ status: 'ready', data: cached, message: 'offline' });
        } else {
          setState({ status: 'error', data: null, message: err.message || 'Failed to load lyrics' });
        }
      });
    return () => controller.abort();
  }, [track?.id, track?.title, track?.artist, track?.album, Math.round(duration || 0), retryTick]);

  // translate lyrics when data is ready and translation is enabled
  // NOTE: timestamps are stripped before translation so LibreTranslate
  // doesn't mangle LRC tags and line mapping stays 1:1
  useEffect(() => {
    if (!lyricsTranslation || (!payload?.syncedLyrics && !payload?.plainLyrics)) {
      clearTranslatedLyrics();
      return undefined;
    }
    const cleanText = payload.syncedLyrics
      ? parseLrc(payload.syncedLyrics).map((l) => l.text).join('\n')
      : (payload.plainLyrics || '');
    if (!cleanText.trim()) return () => clearTranslatedLyrics();
    translateLyrics(cleanText);
    return () => clearTranslatedLyrics();
  }, [payload, lyricsTranslation, lyricsTargetLang, translateLyrics, clearTranslatedLyrics]);
  const syncedLines = useMemo(
    () => (payload?.syncedLyrics ? parseLrc(payload.syncedLyrics) : []),
    [payload?.syncedLyrics],
  );
  const activeIndex = useMemo(
    () => (syncedLines.length ? activeLineIndex(syncedLines, currentTime + offset) : -1),
    [syncedLines, currentTime, offset],
  );

  // auto-scroll to the active line (unless the user took over scrolling)
  useEffect(() => {
    if (activeIndex < 0) return;
    if (Date.now() < suspendUntil.current) return;
    const line = lineRefs.current[activeIndex];
    if (!line) return;
    line.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  const suspendAutoScroll = () => {
    suspendUntil.current = Date.now() + 2500;
    setSuspended(true);
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setSuspended(false), 2500);
  };
  const resumeAutoScroll = () => {
    suspendUntil.current = 0;
    setSuspended(false);
    const line = lineRefs.current[Math.max(0, activeIndex)];
    line?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const currentLang = LANG_OPTIONS.find((o) => o.code === lyricsTargetLang) || LANG_OPTIONS[0];
  const renderBody = () => {
    if (state.status === 'loading') {
      return (
        <div className="lyrics-status">
          <span className="spinner" aria-hidden="true" />
          {t(lang, 'karaoke.loading')}
        </div>
      );
    }
    if (state.status === 'error') {
      return (
        <div className="lyrics-status">
          <AlertCircle size={28} aria-hidden="true" />
          {t(lang, 'karaoke.loadError')}
          <small>{state.message}</small>
          <button className="btn" onClick={() => setRetryTick((n) => n + 1)}>
            <RefreshCw size={15} /> {t(lang, 'common.tryAgain')}
          </button>
        </div>
      );
    }
    if (payload && !payload.found) {
      return (
        <div className="lyrics-status">
          <Mic size={28} aria-hidden="true" />
          {t(lang, 'karaoke.noLyrics')}
          <small>{t(lang, 'lyrics.noLyricsSub')}</small>
        </div>
      );
    }
    if (payload?.instrumental) {
      return (
        <div className="lyrics-status">
          <Music size={30} aria-hidden="true" />
          {t(lang, 'karaoke.instrumental')}
          <small>{t(lang, 'lyrics.instrumentalSub')}</small>
        </div>
      );
    }
    if (syncedLines.length) {
      return (
        <div className="lyrics-scroll" ref={scrollRef} onWheel={suspendAutoScroll} onTouchMove={suspendAutoScroll} aria-label="Synced lyrics">
          {syncedLines.map((line, i) => {
            const cls = ['lyric-line'];
            if (i === activeIndex) cls.push('active');
            if (!line.text) cls.push('empty');
            // get translated text for this line
            const translated = translatedLyrics?.translated;
            let translatedLine = '';
            if (translated && lyricsTranslation) {
              const translatedLines = translated.split('\n');
              translatedLine = translatedLines[i] || '';
            }
            return (
              <button
                key={`${i}-${line.time}`}
                ref={(el) => { lineRefs.current[i] = el; }}
                className={cls.join(' ')}
                onClick={() => line.text && seekTo(Math.max(0, line.time - offset))}
                aria-current={i === activeIndex ? 'true' : undefined}
                disabled={!line.text}
              >
                <div className="lyric-text">{line.text || '♪'}</div>
                {translatedLine && lyricsTranslation && (
                  <div className="lyric-translation">{translatedLine}</div>
                )}
              </button>
            );
          })}
        </div>
      );
    }
    if (payload?.plainLyrics) {
      return (
        <div className="lyrics-scroll" ref={scrollRef} onWheel={suspendAutoScroll}>
          <div className="lyrics-plain">{payload.plainLyrics}</div>
          {translatedLyrics?.translated && lyricsTranslation && (
            <div className="lyrics-plain-translation">{translatedLyrics.translated}</div>
          )}
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)', fontSize: 10.5, letterSpacing: '.18em', padding: '16px 0 40px' }}>
            {t(lang, 'karaoke.plainNote')}
          </div>
        </div>
      );
    }
    return (
      <div className="lyrics-status">
        <Mic size={28} aria-hidden="true" />
        {t(lang, 'lyrics.none')}
      </div>
    );
  };

  return (
    <aside className="lyrics-panel" aria-label={t(lang, 'player.lyrics')}>
      <div className="lyrics-head">
        <h3><Mic size={13} /> {t(lang, 'player.lyrics').toUpperCase()}</h3>
        <div className="lyrics-tools">
          {suspended && (
            <button className="resume-pill" onClick={resumeAutoScroll} aria-label={t(lang, 'lyrics.jumpToLine')} title={t(lang, 'lyrics.jumpToLine')}>
              <LocateFixed size={14} /> {t(lang, 'lyrics.jumpToLine')}
            </button>
          )}
          <button className="icon-btn" onClick={() => setLyricsOffset(Math.round((offset - 0.5) * 10) / 10)} title={t(lang, 'karaoke.earlier')} aria-label={t(lang, 'karaoke.earlier')}>
            <Minus size={15} />
          </button>
          <span title={t(lang, 'karaoke.resetOffset')} onDoubleClick={() => setLyricsOffset(0)} style={{ cursor: 'pointer' }} role="button" aria-label={t(lang, 'karaoke.resetOffset')} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setLyricsOffset(0)}>
            {offset >= 0 ? `+${offset.toFixed(1)}` : offset.toFixed(1)}s
          </span>
          <button className="icon-btn" onClick={() => setLyricsOffset(Math.round((offset + 0.5) * 10) / 10)} title={t(lang, 'karaoke.later')} aria-label={t(lang, 'karaoke.later')}>
            <Plus size={15} />
          </button>
          <button className="icon-btn" onClick={() => setLyricsOffset(0)} title={t(lang, 'karaoke.resetOffset')} aria-label={t(lang, 'karaoke.resetOffset')}>
            <RotateCcw size={14} />
          </button>
          <button
            className={`icon-btn${lyricsTranslation ? ' active' : ''}`}
            onClick={toggleLyricsTranslation}
            aria-pressed={lyricsTranslation}
            aria-label={t(lang, 'karaoke.translate')}
            title={t(lang, 'karaoke.translate')}
          >
            <Globe size={15} />
          </button>
          {payload?.syncedLyrics && (
            <button
              className="icon-btn"
              onClick={() => {
                const blob = new Blob([payload.syncedLyrics], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${String(track.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '').slice(0, 80)} — ${String(track.artist || 'unknown').slice(0, 40)}.lrc`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 2000);
              }}
              title={t(lang, 'lyrics.export')}
              aria-label={t(lang, 'lyrics.export')}
            >
              <Download size={15} />
            </button>
          )}
          {lyricsTranslation && (
            <div className="lang-wrap" ref={langRef}>
              <button
                className="lang-trigger"
                onClick={() => setLangOpen((v) => !v)}
                aria-expanded={langOpen}
                aria-haspopup="menu"
                title={t(lang, 'karaoke.translate')}
              >
                <span className="lang-flag">{currentLang.flag}</span>
                <span className="lang-code">{currentLang.code.toUpperCase()}</span>
                <ChevronDown size={13} className={langOpen ? 'lang-chev open' : 'lang-chev'} />
              </button>
              {langOpen && (
                <div className="lang-menu" role="menu" aria-label={t(lang, 'karaoke.translate')}>
                  <div className="ctx-label">{t(lang, 'karaoke.translateTo')}</div>
                  <div className="lang-list">
                    {LANG_OPTIONS.map((o) => (
                      <button
                        key={o.code}
                        className={`lang-item${o.code === lyricsTargetLang ? ' active' : ''}`}
                        role="menuitemradio"
                        aria-checked={o.code === lyricsTargetLang}
                        onClick={() => { setLyricsTargetLang(o.code); setLangOpen(false); }}
                      >
                        <span className="lang-flag">{o.flag}</span>
                        <span className="lang-name">{o.label}</span>
                        <span className="lang-check">{o.code === lyricsTargetLang && <Check size={15} strokeWidth={3} />}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {renderBody()}
    </aside>
  );
}
