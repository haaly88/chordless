import { useEffect, useRef, useState } from 'react';
import {
  Heart, Play, Shuffle, Music2, Pencil, Check, Trash2, X, ListMusic, Image, Copy,
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

  const tracks = isLikedView ? likes : playlist?.tracks || [];

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [deleteArm, setDeleteArm] = useState(false);
  const [coverEditing, setCoverEditing] = useState(false);
  const [coverUrl, setCoverUrl] = useState('');
  const nameRef = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    setEditing(false);
    setDeleteArm(false);
    setCoverEditing(false);
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '2px 0 12px' }}>
                  <input
                    ref={coverRef}
                    className="field"
                    style={{ flex: 1, fontSize: 15, height: 44 }}
                    value={coverUrl}
                    placeholder="Cover image URL…"
                    onChange={(e) => setCoverUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { commitCover(); }
                      if (e.key === 'Escape') { setCoverEditing(false); }
                    }}
                    aria-label="Playlist cover URL"
                  />
                  <button className="icon-btn accent" onClick={commitCover} aria-label="Save cover"><Check size={22} /></button>
                  <button className="icon-btn" onClick={() => { setCoverEditing(false); setCoverUrl(''); }} aria-label="Cancel"><X size={20} /></button>
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
          <TrackListHeader />
          <div role="rowgroup">
            {tracks.map((track, i) => (
              <TrackRow
                key={`${track.id}-${i}`}
                track={track}
                index={i}
                contextList={tracks}
                playlistId={isLikedView ? undefined : playlistId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
