import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, CloudOff, RotateCcw, Music2, Clapperboard, ListMusic, Flame, User, Disc, Clock, Mic, Bookmark, BookmarkCheck } from 'lucide-react';
import usePlayer from '../store.js';
import { apiSearch, apiAddonSearch } from '../lib/api.js';
import TrackRow, { TrackListHeader } from './TrackRow.jsx';
import { resolveRegion } from '../lib/region.js';

const SUGGESTIONS = ['Top hits 2026', 'Blinding Lights', 'Indonesian pop', 'Lofi hip hop', 'K-pop', 'Taylor Swift', 'City pop', 'Drake', 'Dangdut koplo', 'Phonk'];

export default function SearchView() {
  const query = usePlayer((s) => String(s.searchQuery || ''));
  const setQuery = usePlayer((s) => s.setSearchQuery);
  const focusTick = usePlayer((s) => s.searchFocusTick);
  const searchHistoryRaw = usePlayer((s) => s.searchHistory);
  const searchHistory = Array.isArray(searchHistoryRaw) ? searchHistoryRaw.filter((h) => typeof h === 'string') : [];
  const addSearchHistory = usePlayer((s) => s.addSearchHistory);
  const removeSearchHistory = usePlayer((s) => s.removeSearchHistory);
  const clearSearchHistory = usePlayer((s) => s.clearSearchHistory);
  const savedSearchesRaw = usePlayer((s) => s.savedSearches);
  const savedSearches = Array.isArray(savedSearchesRaw) ? savedSearchesRaw.filter((s) => s?.query) : [];
  const saveSearch = usePlayer((s) => s.saveSearch);
  const removeSavedSearch = usePlayer((s) => s.removeSavedSearch);

  const [filter, setFilter] = useState('all'); // all | song | video
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const [addonResults, setAddonResults] = useState(null);
  const [addonLoading, setAddonLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const voiceRef = useRef(null);
  const canVoice = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const addonAbortRef = useRef(null);
  const debounceRef = useRef(0);
  const addonEnabled = usePlayer((s) => Boolean(s.settings.addon?.enabled && s.settings.addon?.manifest));
  const addonManifest = usePlayer((s) => s.settings.addon?.manifest);
  const addons = usePlayer((s) => s.settings.addons || []);
  const enabledAddons = addons.filter((a) => a.enabled && a.manifest?.base);
  const enabledKey = enabledAddons.map((a) => a.manifest.base).join('|');
  const setView = usePlayer((s) => s.setView);
  const regionSetting = usePlayer((s) => s.settings.region || 'auto');
  const region = resolveRegion(regionSetting);

  // external focus requests (Ctrl+K)
  useEffect(() => {
    if (focusTick > 0) inputRef.current?.focus({ preventScroll: true });
  }, [focusTick]);

  useEffect(() => () => {
    try { voiceRef.current?.abort(); } catch { /* ignore */ }
    voiceRef.current = null;
  }, []);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      voiceRef.current?.abort();
    } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    voiceRef.current = rec;
    setVoiceListening(true);
    rec.onresult = (e) => {
      const text = String(e.results?.[0]?.[0]?.transcript || '').trim();
      if (text) setQuery(text);
    };
    rec.onerror = () => setVoiceListening(false);
    rec.onend = () => setVoiceListening(false);
    try { rec.start(); } catch { setVoiceListening(false); }
  };

  // debounced YTM search
  useEffect(() => {
    const q = query.trim();
    clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults(null); setLoading(false); setError(null);
      abortRef.current?.abort();
      return undefined;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      apiSearch(q, { signal: controller.signal, gl: region.gl, hl: region.hl })
        .then((d) => { setResults(d.results || []); setError(null); addSearchHistory(q); })
        .catch((e) => { if (e.name !== 'AbortError') { setError(e.message || 'Search failed'); setResults(null); } })
        .finally(() => { if (abortRef.current === controller) setLoading(false); });
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, retryTick, region.gl, region.hl]);

  // parallel lossless addon search — queries every enabled addon and merges
  useEffect(() => {
    const q = query.trim();
    const list = enabledAddons;
    if (!list.length || q.length < 2) {
      setAddonResults(null); setAddonLoading(false);
      addonAbortRef.current?.abort();
      return undefined;
    }
    setAddonLoading(true);
    addonAbortRef.current?.abort();
    const controller = new AbortController();
    addonAbortRef.current = controller;
    Promise.allSettled(list.map((a) => apiAddonSearch(a.manifest.base, q, a.manifest.defaultQuality || 'LOSSLESS', { signal: controller.signal })))
      .then((settled) => {
        if (controller.signal.aborted) return;
        const merged = [];
        const seen = new Set();
        for (const r of settled) {
          if (r.status !== 'fulfilled' || r.value.found === false) continue;
          for (const t of (r.value.tracks || [])) {
            const key = `${String(t.title || '').toLowerCase().trim()}|${String(t.artist || '').toLowerCase().trim()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(t);
          }
        }
        setAddonResults(merged);
      })
      .finally(() => { if (addonAbortRef.current === controller) setAddonLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabledKey]);

  const enrichAddonResults = (list) => {
    const byBase = Object.fromEntries(enabledAddons.map((a) => [a.manifest.base, a.manifest]));
    return (list || []).map((track) => {
      const manifest = byBase[track.addonBase] || addonManifest || {};
      const defaultQ = manifest.defaultQuality || 'LOSSLESS';
      const quality = track.audioQuality || defaultQ;
      return {
        ...track,
        isAddon: true,
        addonBase: track.addonBase || manifest.base || '',
        addonName: manifest.name || '',
        audioQuality: quality,
        isLossless: /LOSSLESS/i.test(quality),
        isHiRes: /HI[-_ ]?RES/i.test(quality),
        isDolbyAtmos: /ATMOS/i.test(quality),
      };
    });
  };
  const visibleAddonResults = enrichAddonResults(addonResults);
  const songs = (results || []).filter((t) => t.kind === 'song');
  const videos = (results || []).filter((t) => t.kind === 'video');
  const artists = (results || []).filter((t) => t.kind === 'artist');
  const albums = (results || []).filter((t) => t.kind === 'album');
  const visible = filter === 'song' ? songs : filter === 'video' ? videos : filter === 'artist' ? artists : filter === 'album' ? albums : results || [];

  // Auto-complete: prefix/infix matches from saved + history + trending.
  const suggestions = (() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const seen = new Set();
    const pool = [
      ...savedSearches.map((s) => ({ label: s.query, kind: 'Saved', apply: () => { setQuery(s.query); setFilter(s.filter || 'all'); } })),
      ...searchHistory.map((s) => ({ label: s, kind: 'Recent', apply: () => setQuery(s) })),
      ...SUGGESTIONS.map((s) => ({ label: s, kind: 'Trending', apply: () => setQuery(s) })),
    ];
    const out = [];
    for (const item of pool) {
      const label = String(item.label || '');
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      if (key.includes(q)) {
        seen.add(key);
        out.push(item);
      }
      if (out.length >= 8) break;
    }
    return out;
  })();

  return (
    <div className="search-wrap">
      <div className="search-box" role="search">
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder="Songs, artists, albums…"
          aria-label="Search music"
          autoComplete="off"
          spellCheck="false"
          autoFocus
        />
        {loading && <Loader2 size={20} className="spin" aria-label="Searching" style={{ animation: 'spin .8s linear infinite' }} />}
        {canVoice && (
          <button
            className={`search-clear${voiceListening ? ' listening' : ''}`}
            onClick={voiceListening ? () => voiceRef.current?.abort() : startVoice}
            aria-label={voiceListening ? 'Stop voice search' : 'Voice search'}
            title={voiceListening ? 'Stop voice search' : 'Voice search'}
          >
            <Mic size={17} />
          </button>
        )}
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={17} />
          </button>
        )}
      </div>

      {/* auto-complete suggestions */}
      {query.trim().length >= 1 && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 2px 4px' }} aria-label="Suggestions">
          {suggestions.map((s, i) => (
            <button key={`${s.kind}-${s.label}-${i}`} className="chip" onClick={s.apply} title={`${s.kind}: ${s.label}`}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: 'var(--text-3)', marginRight: 6 }}>{s.kind.toUpperCase()}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* suggestions when empty */}
      {!query.trim() && (
        <>
          {savedSearches.length > 0 && (
            <>
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                <Bookmark size={12} style={{ color: 'var(--text-3)' }} />
                SAVED SEARCHES
              </div>
              <div className="chips">
                {savedSearches.map((s) => (
                  <span key={s.id} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => { setQuery(s.query); setFilter(s.filter || 'all'); }}
                      style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
                      title={`Search “${s.query}” (${s.filter || 'all'})`}
                    >
                      {s.query}{s.filter && s.filter !== 'all' ? ` · ${s.filter}` : ''}
                    </button>
                    <button
                      onClick={() => removeSavedSearch(s.id)}
                      aria-label="Remove saved search"
                      title="Remove saved search"
                      style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </>
          )}
          {searchHistory.length > 0 && (
            <>
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                <Clock size={12} style={{ color: 'var(--text-3)' }} />
                RECENT SEARCHES
                {searchHistory.length > 0 && (
                  <button
                    className="icon-btn"
                    style={{ marginLeft: 'auto', padding: 2 }}
                    onClick={clearSearchHistory}
                    aria-label="Clear recent searches"
                    title="Clear recent searches"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="chips">
                {searchHistory.map((s) => (
                  <button key={s} className="chip" onClick={() => setQuery(s)}>{s}</button>
                ))}
              </div>
            </>
          )}
          <div className="section-label">TRENDING SEARCHES</div>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => setQuery(s)}>{s}</button>
            ))}
          </div>
          <div className="empty-state" style={{ paddingTop: 56 }}>
            <Search />
            <h3>Search music</h3>
            <p>Type at least two characters — results stream as audio only, straight from the source. Press <span className="kbd">Ctrl</span> + <span className="kbd">K</span> anytime to jump here.</p>
          </div>
        </>
      )}

      {/* filter pills + results */}
      {query.trim() && (results || loading || error) && (
        <div className="filter-pills" role="tablist" aria-label="Filter results">
          {[
            { id: 'all', label: `All (${results?.length ?? '…'})`, icon: <ListMusic size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> },
            { id: 'song', label: `Songs (${songs.length})`, icon: <Music2 size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> },
            { id: 'video', label: `Videos (${videos.length})`, icon: <Clapperboard size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> },
            { id: 'artist', label: `Artists (${artists.length})`, icon: <User size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> },
            { id: 'album', label: `Albums (${albums.length})`, icon: <Disc size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> },
          ].map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={`pill${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.icon}{f.label}
            </button>
          ))}
          <button
            className="pill"
            onClick={() => saveSearch(query.trim(), filter)}
            disabled={query.trim().length < 2}
            title="Save this search with the current filter"
            style={{ marginLeft: 'auto' }}
          >
            {savedSearches.some((s) => s.query.toLowerCase() === query.trim().toLowerCase() && (s.filter || 'all') === filter)
              ? <><BookmarkCheck size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Saved</>
              : <><Bookmark size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Save search</>}
          </button>
        </div>
      )}

      {/* lossless addon results — always above the fold when configured */}
      {query.trim().length >= 2 && enabledAddons.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <Flame size={13} style={{ color: 'var(--accent)' }} />
            LOSSLESS · {enabledAddons.map((a) => a.manifest.name).join(' + ')}
          </div>
          {addonLoading && !addonResults && (
            <div aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="skel" style={{ height: 54, marginBottom: 6 }} />)}
            </div>
          )}
          {!addonLoading && addonResults?.length > 0 && (
            <>
              <TrackListHeader />
              <div role="rowgroup">
                {visibleAddonResults.slice(0, 6).map((track, i) => (
                  <TrackRow key={`addon-${track.id}`} track={track} index={i} contextList={visibleAddonResults} />
                ))}
              </div>
              {addonResults.length > 6 && (
                <div className="section-label" style={{ color: 'var(--text-3)', fontSize: 11, paddingLeft: 12, marginTop: 2 }}>
                  {addonResults.length - 6} more lossless results not shown
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="empty-state">
          <CloudOff />
          <h3>Search failed</h3>
          <p>{error}</p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setRetryTick((n) => n + 1)}>
            <RotateCcw size={16} /> Try again
          </button>
        </div>
      )}

      {loading && !results && (
        <div aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skel" style={{ height: 58, marginBottom: 8 }} />)}
        </div>
      )}

      {!error && visible.length > 0 && (
        <>
          {(filter === 'artist' || filter === 'album') && (
            <div className="section-label" style={{ paddingLeft: 2, marginTop: 8 }}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}s
            </div>
          )}
          <div role="rowgroup">
            {visible.map((track, i) => {
              if (track.kind === 'artist' || track.kind === 'album') {
                return (
                  <div
                    key={track.id}
                    className="search-entity-card"
                    onClick={() => setView({ name: track.kind, id: track.browseId || track.id })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setView({ name: track.kind, id: track.browseId || track.id })}
                  >
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="search-entity-art" />
                    ) : (
                      <div className="search-entity-art">
                        {track.kind === 'artist' ? <User size={34} strokeWidth={1.4} /> : <Disc size={34} strokeWidth={1.4} />}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="search-entity-title" title={track.title}>{track.title}</div>
                      <div className="search-entity-sub">
                        {track.kind === 'album' ? (track.artist || 'Unknown artist') : 'Artist'}
                      </div>
                    </div>
                  </div>
                );
              }
              return <TrackRow key={`${track.id}-${i}`} track={track} index={i} contextList={visible} />;
            })}
          </div>
        </>
      )}

      {!loading && !error && results && visible.length === 0 && (
        <div className="empty-state">
          <Search />
          <h3>No matches</h3>
          <p>Nothing found for “{query.trim()}” with this filter.</p>
        </div>
      )}
    </div>
  );
}
