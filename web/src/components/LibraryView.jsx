import { useMemo, useState } from 'react';
import { Heart, Clock, Play, Plus, Music2, Shuffle, Upload, X, Sparkles, TrendingUp, Star, History } from 'lucide-react';
import usePlayer from '../store.js';
import TrackRow, { TrackListHeader } from './TrackRow.jsx';

/** One place for everything you own: likes, playlists, history. */
export default function LibraryView() {
  const liked = usePlayer((s) => s.liked);
  const playlists = usePlayer((s) => s.playlists);
  const folders = usePlayer((s) => s.folders);
  const history = usePlayer((s) => s.history);
  const setView = usePlayer((s) => s.setView);
  const playTracks = usePlayer((s) => s.playTracks);
  const createPlaylist = usePlayer((s) => s.createPlaylist);
  const importPlaylist = usePlayer((s) => s.importPlaylist);
  const forYou = usePlayer((s) => s.forYou);
  const generateForYouMix = usePlayer((s) => s.generateForYouMix);

  const recent = history.slice(0, 10);

  const playYourMix = () => {
    const pool = [...liked, ...history.slice(0, 50)];
    if (!pool.length) return;
    const seen = new Set();
    const tracks = [];
    for (const t of pool) { if (seen.has(t.id)) continue; seen.add(t.id); tracks.push(t); }
    playTracks(tracks, 0, { shuffle: true });
  };

  const quickTiles = [
    { key: 'liked', title: 'Liked Songs', meta: `${liked.length} tracks`, Icon: Heart, className: 'liked', onClick: () => setView({ name: 'liked' }) },
    { key: 'mix', title: 'Your mix', meta: 'Shuffled from likes & history', Icon: Shuffle, className: 'mix', onClick: playYourMix },
    { key: 'stats', title: 'Your stats', meta: 'See your listening', Icon: Clock, className: 'stats', onClick: () => setView({ name: 'stats' }) },
  ];

  const smart = useMemo(() => {
    const forYouTracks = forYou?.tracks || [];
    const recentlyAdded = history.slice(0, 30);
    const mostPlayed = [...history].sort((a, b) => (b.playCount || 1) - (a.playCount || 1)).slice(0, 30);
    const topRated = liked.slice(0, 30);
    return [
      { key: 'for-you', name: 'For You', sub: forYou?.reason || 'AI mix — click to generate', Icon: Sparkles, tracks: forYouTracks },
      { key: 'recent-added', name: 'Recently Added', sub: 'Newest first', Icon: History, tracks: recentlyAdded },
      { key: 'most-played', name: 'Most Played', sub: 'By play count', Icon: TrendingUp, tracks: mostPlayed },
      { key: 'top-rated', name: 'Top Rated', sub: 'Your liked songs', Icon: Star, tracks: topRated },
    ];
  }, [history, liked, forYou]);

  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [smartPreview, setSmartPreview] = useState(null);

  const folderOf = (p) => folders.find((f) => f.id === p.folderId);
  const unfiled = playlists.filter((p) => !p.folderId);

  const renderPlaylistCard = (p) => (
    <button key={p.id} className="playlist-card" onClick={() => setView({ name: 'playlist', id: p.id })}>
      <div className="playlist-art-wrap">
        {p.tracks[0] ? (
          <img src={p.tracks[0].thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="playlist-art-fallback"><Music2 size={34} strokeWidth={1.4} /></div>
        )}
        <span className="pl-play"><Play size={17} fill="#fff" strokeWidth={0} /></span>
      </div>
      <b>{p.name}</b>
      <span>{p.tracks.length} {p.tracks.length === 1 ? 'track' : 'tracks'}{folderOf(p) ? ` · ${folderOf(p).name}` : ''}</span>
    </button>
  );

  const renderSmartCard = (s) => (
    <button key={s.key} className="playlist-card" disabled={s.key !== 'for-you' && !s.tracks.length} onClick={() => {
      if (s.key === 'for-you' && !s.tracks.length) {
        generateForYouMix().then(() => {
          const fresh = usePlayer.getState().forYou;
          if (fresh?.tracks?.length) setSmartPreview({ ...s, tracks: fresh.tracks, sub: fresh.reason });
        });
        return;
      }
      if (s.tracks.length) setSmartPreview(s);
    }}>
      <div className="playlist-art-wrap" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(150deg, color-mix(in srgb, var(--accent) 42%, #1c1c22), #121218)', color: '#fff' }}>
        <s.Icon size={52} strokeWidth={1.4} />
        <span className="pl-play"><Play size={17} fill="#fff" strokeWidth={0} /></span>
      </div>
      <b>{s.name}</b>
      <span>{s.tracks.length} {s.tracks.length === 1 ? 'track' : 'tracks'} · {s.sub}</span>
    </button>
  );

  const smartPreviewTracks = smartPreview?.tracks || [];
  return (
    <div>
      <h1 className="view-title">
        Your library<span className="sub">{liked.length + playlists.length} SAVED ITEMS</span>
      </h1>

      {smartPreview && (
        <div className="collection-hero" style={{ marginBottom: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="hero-kicker">SMART PLAYLIST</div>
            <h1 className="hero-title">{smartPreview.name}</h1>
            <div className="hero-meta">{smartPreview.tracks.length} tracks · {smartPreview.sub}</div>
            <div className="hero-actions">
              <button className="btn primary" onClick={() => playTracks(smartPreview.tracks, 0)} disabled={!smartPreview.tracks.length}>
                <Play size={17} fill="#fff" strokeWidth={0} /> Play
              </button>
              <button className="btn" onClick={() => playTracks(smartPreview.tracks, 0, { shuffle: true })} disabled={!smartPreview.tracks.length}>
                <Shuffle size={16} /> Shuffle
              </button>
              <button className="btn" onClick={() => setSmartPreview(null)}>Back</button>
            </div>
          </div>
        </div>
      )}

      {smartPreview ? (
        smartPreviewTracks.length ? (
          <>
            <TrackListHeader />
            <div role="rowgroup">
              {smartPreviewTracks.map((track, i) => (
                <TrackRow key={`${smartPreview.key}-${track.id}-${i}`} track={track} index={i} contextList={smartPreviewTracks} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state"><Music2 /><h3>No tracks yet</h3><p>Play some songs and they will appear here.</p></div>
        )
      ) : (
      <>
      {/* quick tiles */}
      <div className="lib-tiles">
        {quickTiles.map(({ key, title, meta, Icon, className, onClick }) => (
          <button key={key} className={`lib-tile ${className}`} onClick={onClick}>
            <div className="lib-tile-icon"><Icon size={22} /></div>
            <div className="lib-tile-meta"><b>{title}</b><span>{meta}</span></div>
          </button>
        ))}
      </div>

      {/* smart playlists */}
      <div className="section-label" style={{ paddingLeft: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={13} style={{ color: 'var(--accent)' }} /> SMART PLAYLISTS
      </div>
      <div className="playlist-grid">
        {smart.map(renderSmartCard)}
      </div>

      {/* playlists */}
      <div className="section-label" style={{ paddingLeft: 2 }}>YOUR PLAYLISTS</div>
      <div className="playlist-grid">
        <button className="playlist-card create" onClick={() => { const p = createPlaylist('New Playlist'); setView({ name: 'playlist', id: p.id }); }}>
          <div className="playlist-art-wrap create-art"><Plus size={36} strokeWidth={1.6} /></div>
          <b>New Playlist</b>
          <span>Create one</span>
        </button>
        <button className="playlist-card create" onClick={() => setImportOpen(true)}>
          <div className="playlist-art-wrap create-art"><Upload size={34} strokeWidth={1.6} /></div>
          <b>Import Playlist</b>
          <span>Paste JSON</span>
        </button>
        {unfiled.map(renderPlaylistCard)}
      </div>

      {folders.map((f) => (
        <div key={f.id}>
          <div className="section-label" style={{ paddingLeft: 2, marginTop: 8 }}>{f.name.toUpperCase()}</div>
          <div className="playlist-grid">
            {playlists.filter((p) => p.folderId === f.id).map(renderPlaylistCard)}
            {playlists.filter((p) => p.folderId === f.id).length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '10px 4px' }}>Empty folder — move a playlist here from its page.</div>
            )}
          </div>
        </div>
      ))}

      {/* recently played */}
      <div className="section-label" style={{ paddingLeft: 2 }}>RECENTLY PLAYED</div>
      {recent.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 30 }}>
          <Clock />
          <h3>Nothing yet</h3>
          <p>Play some songs and they’ll show up here.</p>
        </div>
      ) : (
        <>
          <TrackListHeader />
          <div role="rowgroup">
            {recent.map((track, i) => (
              <TrackRow key={`${track.id}-${i}`} track={track} index={i} contextList={recent} />
            ))}
          </div>
        </>
      )}
      </>

      )}

      {/* import playlist modal */}
      {importOpen && (
        <div className="modal-backdrop" onClick={() => setImportOpen(false)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Import playlist" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Import Playlist</h2>
              <button className="icon-btn" onClick={() => setImportOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <p>Paste the playlist JSON you received (copied from another Chordless instance):</p>
            <textarea
              className="field"
              style={{ height: 120, fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"name": "My Playlist", "tracks": [...]}'
              aria-label="Playlist JSON"
            />
            <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => { setImportOpen(false); setImportJson(''); }}>Cancel</button>
              <button className="btn primary" onClick={() => { importPlaylist(importJson); setImportOpen(false); setImportJson(''); }} disabled={!importJson.trim()}>Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
