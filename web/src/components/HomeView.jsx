import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Play, Pause, Sparkles, History, RotateCcw, CloudOff,
  Search, LayoutGrid, X, Check, Shuffle, Heart, ListMusic, Flame, Clock, RefreshCw,
} from 'lucide-react';
import usePlayer, { readMigrated, write } from '../store.js';
import { apiHome, apiSearch, apiCharts } from '../lib/api.js';
import { greeting, formatTime } from '../lib/format.js';
import { t, fmtCount } from '../lib/i18n.js';
import { resolveRegion } from '../lib/region.js';

const MOOD_CHIPS = [
  ['Relax', 'relaxing music'], ['Commute', 'road trip music'], ['Sleep', 'sleep music'],
  ['Sad', 'sad songs'], ['Energize', 'pump up songs'], ['Feel good', 'feel good music'],
  ['Party', 'party songs'], ['Workout', 'workout music'], ['Romance', 'romantic songs'],
  ['Focus', 'focus instrumental'],
];
const MOOD_ID = {
  Relax: 'Santai', Commute: 'Komute', Sleep: 'Tidur', Sad: 'Sedih', Energize: 'Semangat',
  'Feel good': 'Senang', Party: 'Pesta', Workout: 'Olahraga', Romance: 'Romansa', Focus: 'Fokus',
};
const GENRE_CHIPS = [
  ['Pop', 'pop hits'], ['Hip-hop', 'hip hop songs'], ['Rock', 'rock songs'], ['K-Pop', 'kpop hits'],
  ['EDM', 'edm songs'], ['R&B', 'r&b songs'], ['Jazz', 'jazz'], ['Lo-fi', 'lofi hip hop'],
  ['Indie', 'indie music'], ['Metal', 'metal songs'],
];

function QuickTile({ track, contextList }) {
  const active = usePlayer((s) => s.index >= 0 && s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const playTrack = usePlayer((s) => s.playTrack);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  return (
    <button className="quick-tile" onClick={() => (active ? togglePlay() : playTrack(track, contextList))}
            aria-label={`${active && isPlaying ? 'Pause' : 'Play'} ${track.title}`}>
      {track.thumbnail
        ? <img className="qt-art" src={track.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
        : <span className="qt-art" style={{ display: 'grid', placeItems: 'center', background: 'var(--hover-strong)' }}>♪</span>}
      <span style={{ minWidth: 0, paddingRight: 8 }}>
        <span className="qt-title" style={{ display: '-webkit-box' }}>{track.title}</span>
        <span className="qt-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{track.artist || t(lang, 'common.unknownArtist')}</span>
      </span>
      <span className="qt-play" aria-hidden="true">
        {active && isPlaying ? <Pause size={18} fill="#fff" strokeWidth={0} style={{ marginLeft: 0 }} /> : <Play size={17} />}
      </span>
    </button>
  );
}

function ForYouHero({ forYou, loading, onPlay, onShuffle, onRefresh }) {
  const lang = usePlayer((s) => s.settings.lang || 'en');
  const thumbs = (forYou?.tracks || []).slice(0, 4);
  const topArtists = forYou?.topArtists || [];
  if (loading) {
    return (
      <section className="shelf" aria-label="For You">
        <div className="foryou-hero loading" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div className="skel" style={{ width: 132, height: 132, borderRadius: 16, flexShrink: 0 }} />
          <div style={{ flex: 1 }}><div className="skel" style={{ height: 22, width: '40%', marginBottom: 10 }} /><div className="skel" style={{ height: 13, width: '65%' }} /></div>
        </div>
      </section>
    );
  }
  if (!forYou || !forYou.tracks?.length) {
    return (
      <section className="shelf" aria-label="For You">
        <div className="foryou-hero empty" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 88, height: 88, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--hover-strong)', color: 'var(--accent)', flexShrink: 0 }}>
            <Sparkles size={36} strokeWidth={1.4} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="hero-kicker">{t(lang, 'home.foryou.kicker')}</div>
            <div className="foryou-title" style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 4px' }}>{t(lang, 'home.foryou.empty')}</div>
            <p className="foryou-reason" style={{ fontSize: 13, margin: 0 }}>Play a few songs and I’ll build a daily mix from your taste. It refreshes each day.</p>
          </div>
          <button className="btn primary" onClick={onRefresh}><Sparkles size={15} /> Build my mix</button>
        </div>
      </section>
    );
  }
  const mins = forYou.tracks.reduce((s, t) => s + ((t.duration || 0) / 60), 0);
  const minsLabel = mins > 0.5 ? ` · ${Math.round(mins)} min` : '';
  return (
    <section className="shelf" aria-label="For You">
      <div className="foryou-hero">
        <div aria-hidden="true" style={{ position: 'absolute', right: -40, top: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 40%, transparent), transparent 70%)', filter: 'blur(10px)' }} />
        <div className="foryou-thumbs" aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: 132, flexShrink: 0, position: 'relative' }}>
          {thumbs.map((t, i) => (
            <span key={t.id} style={{ width: 62, height: 62, borderRadius: 12, overflow: 'hidden', background: 'var(--hover)', display: i >= 2 ? 'none' : 'block' }}>
              {t.thumbnail ? <img src={t.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
            </span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <div className="hero-kicker">{t(lang, 'home.foryou.kicker')}</div>
          <div className="foryou-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.02, margin: '2px 0 2px' }}>{t(lang, 'home.foryou.title')} <span className="foryou-sub" style={{ fontSize: 13, fontWeight: 600 }}>· {forYou.tracks.length} {t(lang, 'home.tracksSuffix')}{minsLabel}</span></div>
          <p className="foryou-reason" style={{ fontSize: 13, margin: '0 0 10px', lineHeight: 1.5 }}>{lang === 'id' ? (forYou.reason || '').replace(/^Based on /i, 'Berdasarkan ') : (forYou.reason || 'Based on your listening')}</p>
          {topArtists.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              {topArtists.slice(0, 4).map((a) => (
                <span key={a} className="pill" style={{ cursor: 'default', fontSize: 11.5 }}>{a}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={onPlay} disabled={!forYou.tracks.length}>
              <Play size={16} fill="#fff" strokeWidth={0} /> {t(lang, 'btn.play')}
            </button>
            <button className="btn" onClick={onShuffle} disabled={!forYou.tracks.length}><Shuffle size={15} /> {t(lang, 'btn.shuffle')}</button>
            <button className="btn" onClick={onRefresh}><RefreshCw size={14} /> Regenerate</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Shelf({ title, icon, items, onPlayAll }) {
  const rowRef = useRef(null);
  const playTrack = usePlayer((s) => s.playTrack);
  const setView = usePlayer((s) => s.setView);
  const warmTrack = usePlayer((s) => s._warmTrack);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  const activeId = usePlayer((s) => (s.index >= 0 ? s.queue[s.index]?.id : null));
  const isPlaying = usePlayer((s) => s.isPlaying);
  if (!items?.length) return null;
  const playable = items.filter((t) => t.kind !== 'artist' && t.kind !== 'album');
  const handlePlayAll = onPlayAll || (playable.length ? () => usePlayer.getState().playTracks(playable, 0) : null);
  const scrollBy = (dir) => rowRef.current?.scrollBy({ left: dir * 560, behavior: 'smooth' });
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>{icon}{title}</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {handlePlayAll && playable.length > 0 && (
            <button className="icon-btn" onClick={handlePlayAll} title="Play shelf" aria-label="Play all in shelf">
              <Play size={18} fill="currentColor" />
            </button>
          )}
          <button className="icon-btn" onClick={() => scrollBy(-1)} aria-label="Scroll left"><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => scrollBy(1)} aria-label="Scroll right"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="shelf-row" ref={rowRef}>
        {items.map((track) => {
          const isEntity = track.kind === 'artist' || track.kind === 'album';
          const onClick = isEntity
            ? () => setView({ name: track.kind, id: track.browseId || track.id })
            : () => playTrack(track, playable.length ? playable : items);
          return (
          <button key={track.id} className="shelf-card" onClick={onClick}
                  aria-label={`${isEntity ? 'Open' : 'Play'} ${track.title}`}
                  onPointerEnter={() => { if (!isEntity) warmTrack(track); }}
                  onMouseMove={(e) => {
                    const el = e.currentTarget;
                    const rect = el.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width - 0.5;
                    const y = (e.clientY - rect.top) / rect.height - 0.5;
                    el.style.transform = `perspective(700px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-3px)`;
                  }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}>
            <span className="sc-art-wrap">
              <img src={track.thumbnail} alt={`${track.title} artwork`} loading="lazy" referrerPolicy="no-referrer" />
              {!isEntity && (
              <span className="sc-play" aria-hidden="true">
                {activeId === track.id && isPlaying
                  ? <Pause size={18} fill="#fff" strokeWidth={0} style={{ marginLeft: 0 }} />
                  : <Play size={18} />}
              </span>
              )}
            </span>
            <b>{track.title}</b>
            <small>{isEntity ? (track.kind === 'artist' ? t(lang, 'search.artists') : t(lang, 'search.albums')) : (track.artist || t(lang, 'common.unknownArtist'))}{track.duration ? ` · ${formatTime(track.duration)}` : ''}</small>
          </button>
          );
        })}
      </div>
    </section>
  );
}
/** Playlist cards from the home feed ("Trending community playlists"). */
function PlaylistShelf({ playlists }) {
  const setView = usePlayer((s) => s.setView);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  if (!playlists?.length) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2><Sparkles size={17} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />{t(lang, 'home.community')}</h2>
      </div>
      <div className="shelf-row">
        {playlists.map((pl) => (
          <button key={pl.id} className="shelf-card playlist-card-shelf" onClick={() => setView({ name: 'ytplaylist', id: pl.id })}
                  aria-label={`Open playlist ${pl.title}`}>
            <span className="sc-art-wrap">
              <img src={pl.thumbnail} alt={`${pl.title} artwork`} loading="lazy" referrerPolicy="no-referrer" />
            </span>
            <b>{pl.title}</b>
            <small>{pl.views}{pl.author ? ` · ${pl.author}` : ''}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Quick-action shortcut tiles with optional user pinning. */
function ShortcutsRow({ onAddShortcut, pins, onTogglePin }) {
  const liked = usePlayer((s) => s.liked);
  const history = usePlayer((s) => s.history);
  const quickPicks = useMemo(() => history.slice(0, 10), [history]);
  const playTracks = usePlayer((s) => s.playTracks);
  const setView = usePlayer((s) => s.setView);
  const playlists = usePlayer((s) => s.playlists);
  const lang = usePlayer((s) => s.settings.lang || 'en');

  const pinned = playlists.filter((p) => pins.includes(p.id));

  const quick = [
    { key: 'mix', label: t(lang, 'home.yourMix'), sub: t(lang, 'home.yourMixSub'), Icon: Shuffle, onClick: () => { if (!liked.length && !history.length) return; const pool = [...liked, ...history]; const seen = new Set(); const tracks = []; for (const t of pool) { if (!seen.has(t.id)) { seen.add(t.id); tracks.push(t); } } playTracks(tracks, 0, { shuffle: true }); } },
    { key: 'recent', label: t(lang, 'home.recent'), sub: `${Math.min(history.length, 99)} ${t(lang, 'home.recentSub')}`, Icon: History, onClick: () => playTracks(history.slice(0, 20), 0) },
    { key: 'liked', label: t(lang, 'home.shortcut.likedSongs'), sub: `${liked.length} ${t(lang, 'home.likedSub')}`, Icon: Heart, onClick: () => setView({ name: 'liked' }) },
    { key: 'quickpicks', label: t(lang, 'home.quick'), sub: t(lang, 'home.quickSub'), Icon: Sparkles, onClick: () => quickPicks.length && playTracks(quickPicks, 0, { shuffle: true }) },
  ];

  return (
    <section className="shelf" aria-label="Shortcuts">
      <div className="shelf-head">
        <h2><ListMusic size={18} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />{t(lang, 'home.shortcuts')}</h2>
      </div>
      <div className="shortcut-grid">
        {quick.map(({ key, label, sub, Icon, onClick }) => (
          <button key={key} className="shortcut-card" onClick={onClick}>
            <div className="shortcut-icon"><Icon size={19} /></div>
            <div><b>{label}</b><span>{sub}</span></div>
          </button>
        ))}
        {pinned.map((p) => (
          <button key={p.id} className="shortcut-card pinned" onClick={() => setView({ name: 'playlist', id: p.id })} aria-label={`Open pinned playlist ${p.name}`}>
            <img className="shortcut-art" src={p.tracks[0]?.thumbnail || ''} alt="" style={{ visibility: p.tracks[0] ? 'visible' : 'hidden' }} />
            <div style={{ minWidth: 0 }}><b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{p.name}</b><span>{p.tracks.length} tracks · pinned</span></div>
            <span
              className="shortcut-unpin"
              role="button"
              aria-label="Unpin shortcut"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onTogglePin(p.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onTogglePin(p.id); } }}
            ><X size={14} /></span>
          </button>
        ))}
        <button className="shortcut-card dashed" onClick={onAddShortcut}>
          <div className="shortcut-add-icon"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M9 3v12M3 9h12"/></svg></div>
          <div><b>{t(lang, 'home.addShortcut')}</b><span>{t(lang, 'home.addShortcutSub')}</span></div>
        </button>
      </div>
    </section>
  );
}

export default function HomeView() {
  const history = usePlayer((s) => s.history);
  const liked = usePlayer((s) => s.liked);
  const playTracks = usePlayer((s) => s.playTracks);
  const setView = usePlayer((s) => s.setView);
  const requestSearchFocus = usePlayer((s) => s.requestSearchFocus);
  const regionSetting = usePlayer((s) => s.settings.region || 'auto');
  const region = resolveRegion(regionSetting);
  const forYou = usePlayer((s) => s.forYou);
  const forYouLoading = usePlayer((s) => s.forYouLoading);
  const generateForYouMix = usePlayer((s) => s.generateForYouMix);
  const homeSections = usePlayer((s) => s.settings.homeSections || {});
  const lang = usePlayer((s) => s.settings.lang || 'en');

  const HOME_SECTIONS = [
    { key: 'foryou', label: 'For You' },
    { key: 'shortcuts', label: 'Shortcuts' },
    { key: 'jump', label: 'Jump back in' },
    { key: 'recent', label: 'Recently added' },
    { key: 'playlists', label: 'Community playlists' },
    { key: 'quickpicks', label: 'Quick picks' },
    { key: 'feeds', label: 'Home feeds & charts' },
  ];
  const orderedKeys = [
    ...HOME_SECTIONS.map((s) => s.key).filter((k) => (homeSections.order || []).includes(k)),
    ...HOME_SECTIONS.map((s) => s.key).filter((k) => !(homeSections.order || []).includes(k)),
  ];
  const hiddenKeys = new Set(homeSections.hidden || []);
  const visibleKeys = orderedKeys.filter((k) => !hiddenKeys.has(k));

  useEffect(() => {
    if (!forYou && !forYouLoading && history.length >= 3) {
      generateForYouMix();
    }
    // only on first mount + when history grows significantly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [home, setHome] = useState(null);   // { shelves, playlists }
  const [charts, setCharts] = useState(null); // { shelves }
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [chipSet, setChipSet] = useState('mood'); // mood | genre
  const [activeChip, setActiveChip] = useState(null); // label or null (All)
  const [chipLoading, setChipLoading] = useState(false);
  const [chipShelf, setChipShelf] = useState(null); // { title, items }

  const [shortcutModal, setShortcutModal] = useState(false);
  const playlists = usePlayer((s) => s.playlists);
  const [pins, setPins] = useState(() => {
    const v = readMigrated('cl:shortcuts', []);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  });
  const togglePin = (id) => setPins((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    write('cl:shortcuts', next);
    return next;
  });

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    apiHome({ signal: controller.signal, gl: region.gl, hl: region.hl })
      .then((d) => setHome({ shelves: d.shelves || [], playlists: d.playlists || [] }))
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message || 'Failed to load home'); });
    return () => controller.abort();
  }, [reloadTick, region.gl, region.hl]);

  // trending charts — localized to the user's region
  useEffect(() => {
    const controller = new AbortController();
    apiCharts({ signal: controller.signal, gl: region.gl, hl: region.hl })
      .then((d) => setCharts({ shelves: d.shelves || [], gl: d.gl || region.gl }))
      .catch((e) => { if (e.name !== 'AbortError') setCharts(null); });
    return () => controller.abort();
  }, [region.gl, region.hl]);

  // chip → themed shelf via search
  useEffect(() => {
    if (!activeChip) { setChipShelf(null); return undefined; }
    const all = [...MOOD_CHIPS, ...GENRE_CHIPS];
    const found = all.find(([label]) => label === activeChip);
    if (!found) return undefined;
    setChipLoading(true);
    const controller = new AbortController();
    apiSearch(found[1], { signal: controller.signal, limit: 24 })
      .then((d) => setChipShelf({ title: found[0], items: d.results || [] }))
      .catch((e) => { if (e.name !== 'AbortError') setChipShelf({ title: found[0], items: [] }); })
      .finally(() => setChipLoading(false));
    return () => controller.abort();
  }, [activeChip]);

  const quickPicks = useMemo(() => {
    const fromHistory = history.slice(0, 10);
    if (fromHistory.length >= 6) return fromHistory;
    const fromShelves = (home?.shelves || []).flatMap((s) => s.items);
    const seen = new Set(fromHistory.map((t) => t.id));
    const merged = [...fromHistory];
    for (const t of fromShelves) {
      if (merged.length >= 10) break;
      if (!seen.has(t.id)) { seen.add(t.id); merged.push(t); }
    }
    return merged;
  }, [history, home]);

  const recentShelf = useMemo(() => {
    const seen = new Set();
    return history.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))).slice(0, 14);
  }, [history]);

  const recentlyAdded = useMemo(() => {
    const seen = new Set();
    const pool = [...history, ...liked];
    return pool.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))).slice(0, 14);
  }, [history, liked]);

  const now = new Date();
  const dateLine = now.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const chips = chipSet === 'mood' ? MOOD_CHIPS : GENRE_CHIPS;

  // Pull-to-refresh (touch): pull down at top of scroll to reload feed.
  const pullStart = useRef(null);
  const [pulling, setPulling] = useState(false);
  const onTouchStart = (e) => {
    const el = e.currentTarget.closest('.main');
    if (el && el.scrollTop <= 0) pullStart.current = e.touches?.[0]?.clientY ?? null;
  };
  const onTouchMove = (e) => {
    if (pullStart.current == null) return;
    const y = e.touches?.[0]?.clientY ?? 0;
    setPulling(y - pullStart.current > 90);
  };
  const onTouchEnd = () => {
    if (pulling) setReloadTick((n) => n + 1);
    pullStart.current = null;
    setPulling(false);
  };

  return (
    <div aria-label="Home" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {pulling && <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--accent)', fontWeight: 700, padding: '6px 0' }}>Release to refresh…</div>}
      {/* head row: greeting + refresh + search pill */}
      <div className="home-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="greeting">{greeting(now, lang)}</h1>
          <div className="greeting-sub">{dateLine} · {t(lang, 'home.pickSomething')}</div>
        </div>
        <div className="home-head-actions">
          <button className="icon-btn home-refresh" onClick={() => setReloadTick((n) => n + 1)} aria-label="Refresh feed" title="Refresh feed">
            <RotateCcw size={18} />
          </button>
          <button className="search-pill" onClick={() => { setView({ name: 'search' }); requestSearchFocus(); }} aria-label={t(lang, 'home.search')}>
            <Search size={17} />
            <span>{t(lang, 'home.search')}</span>
            <kbd>Ctrl+K</kbd>
          </button>
        </div>
      </div>

      {/* category chips */}
      <div className="chip-row" role="tablist" aria-label="Filter home by mood or genre">
        <button className="chip-grid" onClick={() => setChipSet((s) => (s === 'mood' ? 'genre' : 'mood'))}
                aria-label={chipSet === 'mood' ? 'Show genre filters' : 'Show mood filters'}
                title={chipSet === 'mood' ? 'Show genres' : 'Show moods'}>
          <LayoutGrid size={17} />
        </button>
        <button role="tab" aria-selected={!activeChip} className={`pill${!activeChip ? ' active' : ''}`} onClick={() => setActiveChip(null)}>{lang === 'id' ? t(lang, 'home.chip.all') : 'All'}</button>
        {chips.map(([label]) => {
          const display = lang === 'id' ? MOOD_ID[label] || label : label;
          return (
            <button key={label} role="tab" aria-selected={activeChip === label}
                    className={`pill${activeChip === label ? ' active' : ''}`}
                    onClick={() => setActiveChip((cur) => (cur === label ? null : label))}>
              {display}
            </button>
          );
        })}
      </div>

      {activeChip ? (
        chipLoading ? (
          <div className="shelf"><div className="shelf-row">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" style={{ width: 152, height: 152, borderRadius: 12 }} />)}</div></div>
        ) : chipShelf?.items?.length ? (
          <Shelf title={chipShelf.title} icon={<Sparkles size={17} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />}
                 items={chipShelf.items} onPlayAll={() => playTracks(chipShelf.items, 0)} />
        ) : (
          <div className="empty-state"><CloudOff /><h3>No matches</h3><p>Couldn’t load that {chipSet} — try another.</p></div>
        )
      ) : (
        <>
          {visibleKeys.map((key) => {
            if (key === 'foryou') {
              return (
                <ForYouHero
                  key={key}
                  forYou={forYou}
                  loading={forYouLoading}
                  onPlay={() => forYou?.tracks?.length && playTracks(forYou.tracks, 0)}
                  onShuffle={() => forYou?.tracks?.length && playTracks(forYou.tracks, 0, { shuffle: true })}
                  onRefresh={() => generateForYouMix()}
                />
              );
            }
            if (key === 'shortcuts') return <ShortcutsRow key={key} onAddShortcut={() => setShortcutModal(true)} pins={pins} onTogglePin={togglePin} />;
            if (key === 'jump') {
              return recentShelf.length >= 2 ? (
                <Shelf key={key} title={t(lang, 'home.jump')} icon={<History size={18} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />}
                  items={recentShelf} onPlayAll={() => playTracks(recentShelf, 0)} />
              ) : null;
            }
            if (key === 'recent') {
              return recentlyAdded.length >= 2 ? (
                <Shelf key={key} title={t(lang, 'home.recentAdded')} icon={<Clock size={18} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />}
                  items={recentlyAdded} onPlayAll={() => playTracks(recentlyAdded, 0)} />
              ) : null;
            }
            if (key === 'playlists') return <PlaylistShelf key={key} playlists={home?.playlists} />;
            if (key === 'quickpicks') {
              return quickPicks.length > 0 ? (
                <div key={key}>
                  <div className="section-label" style={{ paddingLeft: 2 }}>{t(lang, 'home.quick').toUpperCase()}</div>
                  <div className="quick-grid">
                    {quickPicks.slice(0, 6).map((t) => <QuickTile key={t.id} track={t} contextList={quickPicks} />)}
                  </div>
                </div>
              ) : null;
            }
            return null;
          })}

          {!home && !error && visibleKeys.includes('feeds') && (
            <div className="shelf" aria-busy="true">
              <div className="shelf-head"><h2>{t(lang, 'home.loading')}</h2></div>
              <div className="shelf-row">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} style={{ width: 172 }}>
                    <div className="skel" style={{ width: 152, height: 152, borderRadius: 12, margin: '0 auto 10px' }} />
                    <div className="skel" style={{ height: 13, width: '90%', marginBottom: 6 }} />
                    <div className="skel" style={{ height: 11, width: '60%' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="empty-state">
              <CloudOff />
              <h3>{t(lang, 'home.feedErrorTitle')}</h3>
              <p>{t(lang, 'home.feedErrorSub')}</p>
              <button className="btn primary" style={{ marginTop: 18 }} onClick={() => { setHome(null); setError(null); setReloadTick((n) => n + 1); }}>
                <RotateCcw size={16} /> {t(lang, 'common.tryAgain')}
              </button>
            </div>
          )}
          {visibleKeys.includes('feeds') && home?.shelves?.map((shelf) => (
            <Shelf key={shelf.title} title={shelf.title} items={shelf.items}
                   icon={<Sparkles size={17} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />}
                   onPlayAll={() => playTracks(shelf.items, 0)} />
          ))}
          {visibleKeys.includes('feeds') && charts?.shelves?.map((shelf) => (
            <Shelf key={shelf.title} title={`${shelf.title} · ${region.label}`} items={shelf.items}
                   icon={<Flame size={17} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />}
                   onPlayAll={() => playTracks(shelf.items, 0)} />
          ))}
          {visibleKeys.includes('feeds') && home && home.shelves.length === 0 && !error && (
            <div className="empty-state">
              <Sparkles />
              <h3>{t(lang, 'home.feedEmptyTitle')}</h3>
              <p>{t(lang, 'home.feedEmptySub')}</p>
              <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setReloadTick((n) => n + 1)}>
                <RotateCcw size={16} /> {t(lang, 'common.tryAgain')}
              </button>
            </div>
          )}
        </>
      )}

      {/* add-a-shortcut modal */}
      {shortcutModal && (
        <div className="modal-backdrop" onClick={() => setShortcutModal(false)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Pin a playlist" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>{t(lang, 'home.addShortcutTitle')}</h2>
              <button className="icon-btn" onClick={() => setShortcutModal(false)} aria-label={t(lang, 'btn.close')}><X size={19} /></button>
            </div>
            <p>{t(lang, 'home.addShortcutDesc')}</p>
            {playlists.length === 0 ? (
              <p style={{ color: 'var(--text-3)' }}>{t(lang, 'home.noPlaylistsShort')}</p>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {playlists.map((p) => {
                  const pinned = pins.includes(p.id);
                  return (
                    <button key={p.id} className="ctx-item" style={{ fontSize: 13.5 }} onClick={() => { togglePin(p.id); setShortcutModal(false); }}>
                      <span className="check-slot">{pinned && <Check size={16} strokeWidth={3} />}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11.5 }}>{fmtCount(lang, p.tracks.length, p.tracks.length === 1 ? 'track' : 'tracks')}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
