import { useEffect, useRef, useState } from 'react';
import {
  Heart, Play, Shuffle, Music2, Pencil, Check, Trash2, X, ListMusic, Image, Copy,
  ArrowDownAZ, Files, Merge, CheckSquare,
} from 'lucide-react';
import usePlayer from '../store.js';
import { formatTotalDuration, pluralize } from '../lib/format.js';
import TrackRow, { TrackListHeader } from './TrackRow.jsx';

function HeroArt({ playlist }) {
  if (!playlist) {
    return (
      <div className="hero-art liked">
        <Heart aria-hidden="true" />
      </div>
    );
  }
  if (playlist.coverUrl) {
    return <img className="hero-art" src={playlist.coverUrl} alt="Playlist artwork" referrerPolicy="no-referrer" />;
  }
  const covers = [...new Set(playlist.tracks.map((t) => t.thumbnail).filter(Boolean))].slice(0, 4);
  if (covers.length === 0) {
    return (
      <div className="hero-art playlist-fallback">
        <Music2 strokeWidth={1.4} aria-hidden="true" />
      </div>
    );
  }
  if (covers.length === 1) {
    return <img className="hero-art" src={covers[0]} alt="Playlist artwork" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="hero-art mosaic" style={{ display: 'grid' }}>
      {covers.map((c) => <img key={c} src={c} alt="" referrerPolicy="no-referrer" />)}
    </div>
  );
}

export default function CollectionView({ playlistId }) {
  const isLikedView = !playlistId;
  const likes = usePlayer((s) => s.liked);
  const playlists = usePlayer((s) => s.playlists);
  const playlist = playlistId ? playlists.find((p) => p.id === playlistId) : null;
  const playTracks = usePlayer((s) => s.playTracks);
  const renamePlaylist = usePlayer((s) => s.renamePlaylist);
  const deletePlaylist = usePlayer((s) => s.deletePlaylist);
  const updatePlaylistCover = usePlayer((s) => s.updatePlaylistCover);
  const sharePlaylist = usePlayer((s) => s.sharePlaylist);
  const folders = usePlayer((s) => s.folders);
  const setPlaylistFolder = usePlayer((s) => s.setPlaylistFolder);
  const setView = usePlayer((s) => s.setView);
  const toast = usePlayer((s) => s.toast);
  const sortPlaylist = usePlayer((s) => s.sortPlaylist);
  const dedupePlaylist = usePlayer((s) => s.dedupePlaylist);
  const mergePlaylist = usePlayer((s) => s.mergePlaylist);
  const removeTracksFromPlaylist = usePlayer((s) => s.removeTracksFromPlaylist);

  const tracks = isLikedView ? likes : playlist?.tracks || [];

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [deleteArm, setDeleteArm] = useState(false);
  const [coverEditing, setCoverEditing] = useState(false);
  const [coverUrl, setCoverUrl] = useState('');
  const [sortMode, setSortMode] = useState('az');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const nameRef = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    setEditing(false);
    setDeleteArm(false);
    setCoverEditing(false);
    setBulkMode(false);
    setSelected(new Set());
    setMergeOpen(false);
    setName(playlist?.name || '');
    setCoverUrl(playlist?.coverUrl || '');
  }, [playlistId]);

  useEffect(() => {
    if (editing) nameRef.current?.select();
  }, [editing]);

  // playlist missing (deleted / stale id)
  if (!isLikedView && !playlist) {
    return (
      <div className="empty-state">
        <ListMusic />
        <h3>Playlist not found</h3>
        <p>It may have been deleted.</p>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setView({ name: 'home' })}>Go home</button>
      </div>
    );
  }

  const title = isLikedView ? 'Liked Songs' : playlist.name;

  const commitRename = () => {
    if (playlistId) renamePlaylist(playlistId, name);
    setEditing(false);
  };

  const commitCover = () => {
    if (playlistId) updatePlaylistCover(playlistId, coverUrl.trim() || undefined);
    setCoverEditing(false);
    setCoverUrl('');
  };

  return (
    <div>
      <div className="collection-hero">
        <HeroArt playlist={playlist} />
        <div style={{ minWidth: 0 }}>
          <div className="hero-kicker">{isLikedView ? 'PLAYLIST' : 'PLAYLIST'}</div>

          {editing ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '2px 0 12px' }}>
              <input
                ref={nameRef}
                className="field"
                style={{ fontSize: 26, fontWeight: 800, height: 54, letterSpacing: '-0.02em' }}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setName(playlist?.name || ''); setEditing(false); }
                }}
                aria-label="Playlist name"
              />
              <button className="icon-btn accent" onClick={commitRename} aria-label="Save name"><Check size={22} /></button>
              <button className="icon-btn" onClick={() => { setName(playlist?.name || ''); setEditing(false); }} aria-label="Cancel"><X size={20} /></button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <h1 className="hero-title">{title}</h1>
                {!isLikedView && (
                  <>
                    <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Rename playlist" title="Rename">
                      <Pencil size={19} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => { setCoverEditing(true); setCoverUrl(playlist?.coverUrl || ''); }}
                      aria-label="Change playlist cover"
                      title="Change cover"
                    >
                      <Image size={19} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => sharePlaylist(playlist.id)}
                      aria-label="Share playlist (copy to clipboard)"
                      title="Share playlist"
                    >
                      <Copy size={19} />
                    </button>
                  </>
                )}
              </div>
              {coverEditing && !editing && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '2px 0 12px', flexWrap: 'wrap' }}>
                  <input
                    ref={coverRef}
                    className="field"
                    style={{ flex: 1, minWidth: 200, fontSize: 15, height: 44 }}
                    value={coverUrl}
                    placeholder="Cover image URL… (empty = auto collage)"
                    onChange={(e) => setCoverUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { commitCover(); }
                      if (e.key === 'Escape') { setCoverEditing(false); }
                    }}
                    aria-label="Playlist cover URL"
                  />
                  <button className="icon-btn accent" onClick={commitCover} aria-label="Save cover"><Check size={22} /></button>
                  <button className="icon-btn" onClick={() => { setCoverEditing(false); setCoverUrl(''); }} aria-label="Cancel"><X size={20} /></button>
                  <button
                    className="pill"
                    onClick={() => { updatePlaylistCover(playlistId, undefined); setCoverEditing(false); toast('Auto cover on', 'Artwork collage restored.'); }}
                    title="Use automatic collage cover from track art"
                  >
                    Use auto cover
                  </button>
                </div>
              )}
            </>
          )}

          {!isLikedView && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <select
                value={playlist?.folderId || ''}
                onChange={(e) => setPlaylistFolder(playlistId, e.target.value || null)}
                aria-label="Playlist folder"
                className="field"
                style={{ width: 200, height: 38, fontSize: 12.5 }}
              >
                <option value="">Unfiled</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Folder</span>
            </div>
          )}

          <div className="hero-meta">{pluralize(tracks.length, 'track')}{tracks.length ? <> · {formatTotalDuration(tracks)}</> : null}</div>

          <div className="hero-actions">
            <button className="btn primary" onClick={() => playTracks(tracks, 0)} disabled={!tracks.length}>
              <Play size={17} fill="#fff" strokeWidth={0} /> Play
            </button>
            <button className="btn" onClick={() => playTracks(tracks, 0, { shuffle: true })} disabled={!tracks.length}>
              <Shuffle size={16} /> Shuffle
            </button>
            {!isLikedView && (
              <button
                className={`btn danger${deleteArm ? ' armed' : ''}`}
                onClick={() => (deleteArm ? deletePlaylist(playlistId) : setDeleteArm(true))}
                onBlur={() => setDeleteArm(false)}
                title={deleteArm ? 'Click again to delete' : 'Delete playlist'}
              >
                <Trash2 size={16} /> {deleteArm ? 'Confirm delete' : 'Delete'}
              </button>
            )}
          </div>
          {!isLikedView && tracks.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }} aria-label="Playlist tools">
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--text-3)' }}>TOOLS</span>
              <select
                value={sortMode}
                onChange={(e) => { setSortMode(e.target.value); sortPlaylist(playlistId, e.target.value); }}
                aria-label="Sort playlist"
                className="pill"
                style={{ cursor: 'pointer' }}
              >
                <option value="az">Sort: A → Z</option>
                <option value="za">Sort: Z → A</option>
                <option value="artist">Sort: Artist</option>
                <option value="duration-desc">Longest first</option>
                <option value="duration-asc">Shortest first</option>
              </select>
              <button className="pill" onClick={() => dedupePlaylist(playlistId)} title="Remove duplicate tracks">
                <Files size={14} /> Dedupe
              </button>
              <button className="pill" onClick={() => setMergeOpen(true)} title="Merge another playlist into this one">
                <Merge size={14} /> Merge
              </button>
              <button
                className={`pill${bulkMode ? ' active' : ''}`}
                onClick={() => { setBulkMode((v) => !v); setSelected(new Set()); }}
                aria-pressed={bulkMode}
                title="Select tracks to remove in bulk"
              >
                <CheckSquare size={14} /> {bulkMode ? 'Done' : 'Select'}
              </button>
            </div>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="empty-state">
          <Heart strokeWidth={1.4} />
          <h3>{isLikedView ? 'No likes yet' : 'Empty playlist'}</h3>
          <p>
            {isLikedView
              ? 'Tap the heart on any track — it will land here, synced across your queue instantly.'
              : 'Right-click any track and choose “Add to playlist”, or use the ⋯ button next to a song.'}
          </p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setView({ name: 'search' })}>
            <Play size={16} fill="#fff" strokeWidth={0} /> Find music
          </button>
        </div>
      ) : (
        <>
          {bulkMode && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 12px', marginBottom: 8, border: '1px solid var(--stroke)', borderRadius: 14, background: 'var(--glass)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{selected.size} selected</span>
              <button className="pill" onClick={() => setSelected(new Set(tracks.map((t) => t.id)))}>Select all</button>
              <button className="pill" onClick={() => setSelected(new Set())}>Clear</button>
              <button
                className="pill"
                style={{ color: '#ff7a7a', borderColor: 'rgba(255,90,90,.4)' }}
                onClick={() => { removeTracksFromPlaylist(playlistId, [...selected]); setSelected(new Set()); }}
                disabled={!selected.size}
              >
                <Trash2 size={14} /> Remove selected
              </button>
            </div>
          )}
          <TrackListHeader />
          <div role="rowgroup">
            {tracks.map((track, i) => {
              const checked = selected.has(track.id);
              return (
                <div key={`${track.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: bulkMode ? 10 : 0 }}>
                  {bulkMode && (
                    <button
                      className={`icon-btn${checked ? ' active' : ''}`}
                      style={{ color: checked ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }}
                      onClick={() => setSelected((prev) => { const next = new Set(prev); if (next.has(track.id)) next.delete(track.id); else next.add(track.id); return next; })}
                      aria-pressed={checked}
                      aria-label={checked ? 'Deselect' : 'Select'} title={checked ? 'Deselect' : 'Select'}
                    >
                      {checked ? <Check size={18} strokeWidth={3} /> : <span style={{ width: 18, height: 18, border: '1.5px solid currentColor', borderRadius: 5, display: 'block' }} />}
                    </button>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TrackRow
                      track={track}
                      index={i}
                      contextList={tracks}
                      playlistId={isLikedView ? undefined : playlistId}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {mergeOpen && (
        <div className="modal-backdrop" onClick={() => setMergeOpen(false)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Merge playlist" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Merge into “{playlist?.name}”</h2>
              <button className="icon-btn" onClick={() => setMergeOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <p>Pick a playlist to merge in. New tracks are appended (duplicates skipped).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
              {playlists.filter((p) => p.id !== playlistId).map((p) => (
                <button key={p.id} className="ctx-item" onClick={() => { mergePlaylist(playlistId, p.id); setMergeOpen(false); }}>
                  <ListMusic size={16} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11.5 }}>{p.tracks.length} tracks</span>
                </button>
              ))}
              {playlists.filter((p) => p.id !== playlistId).length === 0 && (
                <div className="ctx-empty">No other playlists to merge</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
