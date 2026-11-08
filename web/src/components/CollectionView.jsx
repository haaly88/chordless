import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Heart, Play, Shuffle, Music2, Pencil, Check, Trash2, X, ListMusic, Image, Copy,
  ArrowDownAZ, Files, Merge, CheckSquare, Link2, Download, Loader2,
} from 'lucide-react';
import usePlayer from '../store.js';
import { formatTotalDuration } from '../lib/format.js';
import { detectGenre, GENRE_LABELS } from '../lib/genre.js';
import { t, fmtCount } from '../lib/i18n.js';
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
  const sharePlaylistLink = usePlayer((s) => s.sharePlaylistLink);
  const folders = usePlayer((s) => s.folders);
  const setPlaylistFolder = usePlayer((s) => s.setPlaylistFolder);
  const setView = usePlayer((s) => s.setView);
  const toast = usePlayer((s) => s.toast);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  const sortPlaylist = usePlayer((s) => s.sortPlaylist);
  const dedupePlaylist = usePlayer((s) => s.dedupePlaylist);
  const mergePlaylist = usePlayer((s) => s.mergePlaylist);
  const removeTracksFromPlaylist = usePlayer((s) => s.removeTracksFromPlaylist);
  const downloadTrack = usePlayer((s) => s.downloadTrack);

  const tracks = isLikedView ? likes : playlist?.tracks || [];
  const genreCounts = useMemo(() => {
    const counts = {};
    for (const t of tracks) {
      const g = detectGenre(t);
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [tracks]);
  const visibleTracks = genreFilter === 'all' ? tracks : tracks.filter((t) => detectGenre(t) === genreFilter);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [deleteArm, setDeleteArm] = useState(false);
  const [coverEditing, setCoverEditing] = useState(false);
  const [coverUrl, setCoverUrl] = useState('');
  const [sortMode, setSortMode] = useState('az');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [genreFilter, setGenreFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const nameRef = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    setEditing(false);
    setDeleteArm(false);
    setCoverEditing(false);
    setBulkMode(false);
    setGenreFilter('all');
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
        <h3>{t(lang, 'coll.notFound')}</h3>
        <p>{t(lang, 'coll.notFoundSub')}</p>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setView({ name: 'home' })}>{t(lang, 'common.goHome')}</button>
      </div>
    );
  }

  const title = isLikedView ? t(lang, 'home.shortcut.likedSongs') : playlist.name;

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
                  if (e.key === 'Escape') { e.stopPropagation(); setName(playlist?.name || ''); setEditing(false); }
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
                      aria-label="Share playlist (copy JSON to clipboard)"
                      title="Share playlist (JSON)"
                    >
                      <Copy size={19} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => sharePlaylistLink(playlist.id)}
                      aria-label="Copy share link"
                      title="Copy share link (7-day expiry)"
                    >
                      <Link2 size={19} />
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
                    placeholder={t(lang, 'coll.coverPh')}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { commitCover(); }
                      if (e.key === 'Escape') { e.stopPropagation(); setCoverEditing(false); }
                    }}
                    aria-label="Playlist cover URL"
                  />
                  <button className="icon-btn accent" onClick={commitCover} aria-label="Save cover"><Check size={22} /></button>
                  <button className="icon-btn" onClick={() => { setCoverEditing(false); setCoverUrl(''); }} aria-label="Cancel"><X size={20} /></button>
                  <button
                    className="pill"
                    onClick={() => { updatePlaylistCover(playlistId, undefined); setCoverEditing(false); toast('Auto cover on', 'Artwork collage restored.'); }}
                    title={t(lang, 'coll.autoCoverTitle')}
                  >
                    {t(lang, 'coll.autoCover')}
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
                aria-label={t(lang, 'coll.folderSelect')}
                className="field"
                style={{ width: 200, height: 38, fontSize: 12.5 }}
              >
                <option value="">{t(lang, 'coll.unfiled')}</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t(lang, 'coll.folder')}</span>
            </div>
          )}

          <div className="hero-meta">{fmtCount(lang, tracks.length, tracks.length === 1 ? 'track' : 'tracks')}{tracks.length ? <> · {formatTotalDuration(tracks, lang)}</> : null}</div>

          <div className="hero-actions">
            <button className="btn primary" onClick={() => playTracks(tracks, 0)} disabled={!tracks.length}>
              <Play size={17} fill="#fff" strokeWidth={0} /> {t(lang, 'btn.play')}
            </button>
            <button className="btn" onClick={() => playTracks(tracks, 0, { shuffle: true })} disabled={!tracks.length}>
              <Shuffle size={16} /> {t(lang, 'btn.shuffle')}
            </button>
            {!isLikedView && (
              <button
                className={`btn danger${deleteArm ? ' armed' : ''}`}
                onClick={() => (deleteArm ? deletePlaylist(playlistId) : setDeleteArm(true))}
                onBlur={() => setDeleteArm(false)}
                title={deleteArm ? t(lang, 'coll.confirmDelete') : t(lang, 'coll.deleteTitle')}
              >
                <Trash2 size={16} /> {deleteArm ? t(lang, 'coll.confirmDelete') : t(lang, 'btn.delete')}
              </button>
            )}
          </div>
          {!isLikedView && tracks.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }} aria-label={t(lang, 'coll.tools')}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--text-3)' }}>{t(lang, 'coll.tools')}</span>
              <select
                value={sortMode}
                onChange={(e) => { setSortMode(e.target.value); sortPlaylist(playlistId, e.target.value); }}
                aria-label={t(lang, 'coll.sortSelect')}
                className="pill"
                style={{ cursor: 'pointer' }}
              >
                <option value="az">{t(lang, 'coll.sortAZ')}</option>
                <option value="za">{t(lang, 'coll.sortZA')}</option>
                <option value="artist">{t(lang, 'coll.sortArtist')}</option>
                <option value="duration-desc">{t(lang, 'coll.sortLongest')}</option>
                <option value="duration-asc">{t(lang, 'coll.sortShortest')}</option>
              </select>
              <button className="pill" onClick={() => dedupePlaylist(playlistId)} title={t(lang, 'coll.dedupeTitle')}>
                <Files size={14} /> {t(lang, 'coll.dedupe')}
              </button>
              <button className="pill" onClick={() => setMergeOpen(true)} title={t(lang, 'coll.mergeTitleHint')}>
                <Merge size={14} /> {t(lang, 'coll.merge')}
              </button>
              <button
                className={`pill${bulkMode ? ' active' : ''}`}
                onClick={() => { setBulkMode((v) => !v); setSelected(new Set()); }}
                aria-pressed={bulkMode}
                title={t(lang, 'coll.selectHint')}
              >
                <CheckSquare size={14} /> {bulkMode ? t(lang, 'coll.done') : t(lang, 'coll.select')}
              </button>
              <button
                className="pill"
                onClick={async () => {
                  setBulkDownloading(true);
                  let ok = 0;
                  for (const tr of tracks) {
                    if ((await downloadTrack(tr)) === true) ok += 1;
                  }
                  setBulkDownloading(false);
                  toast('Bulk download done', t(lang, 'coll.bulkDoneSub').replace('{ok}', ok).replace('{total}', tracks.length));
                }}
                disabled={bulkDownloading}
                title={t(lang, 'coll.downloadAllTitle')}
              >
                {bulkDownloading ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> : <Download size={14} />} {bulkDownloading ? t(lang, 'coll.downloading') : t(lang, 'coll.downloadAll')}
              </button>
            </div>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="empty-state">
          <Heart strokeWidth={1.4} />
          <h3>{isLikedView ? t(lang, 'coll.emptyLiked') : t(lang, 'coll.empty')}</h3>
          <p>
            {isLikedView
              ? t(lang, 'coll.emptyLikedHint')
              : t(lang, 'coll.emptyHint')}
          </p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setView({ name: 'search' })}>
            <Play size={16} fill="#fff" strokeWidth={0} /> {t(lang, 'coll.findMusic')}
          </button>
        </div>
      ) : (
        <>
          {bulkMode && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 12px', marginBottom: 8, border: '1px solid var(--stroke)', borderRadius: 14, background: 'var(--glass)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{selected.size} {t(lang, 'coll.selected')}</span>
              <button className="pill" onClick={() => setSelected(new Set(tracks.map((tr) => tr.id)))}>{t(lang, 'coll.selectAll')}</button>
              <button className="pill" onClick={() => setSelected(new Set())}>{t(lang, 'btn.clear')}</button>
              <button
                className="pill"
                style={{ color: '#ff7a7a', borderColor: 'rgba(255,90,90,.4)' }}
                onClick={() => { removeTracksFromPlaylist(playlistId, [...selected]); setSelected(new Set()); }}
                disabled={!selected.size}
              >
                <Trash2 size={14} /> {t(lang, 'coll.removeSelected')}
              </button>
            </div>
          )}
          {Object.keys(genreCounts).length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 10px' }} aria-label="Filter by genre">
              <button className={`pill${genreFilter === 'all' ? ' active' : ''}`} onClick={() => setGenreFilter('all')}>All ({tracks.length})</button>
              {Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([g, count]) => (
                <button key={g} className={`pill${genreFilter === g ? ' active' : ''}`} onClick={() => setGenreFilter(g)}>
                  {GENRE_LABELS[g] || g} ({count})
                </button>
              ))}
            </div>
          )}
          <TrackListHeader />
          <div role="rowgroup">
            {visibleTracks.map((track, i) => {
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
          <div className="modal" role="dialog" aria-modal="true" aria-label={t(lang, 'coll.merge')} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>{t(lang, 'coll.mergeTitle').replace('{name}', playlist?.name || '')}</h2>
              <button className="icon-btn" onClick={() => setMergeOpen(false)} aria-label={t(lang, 'btn.close')}><X size={20} /></button>
            </div>
            <p>{t(lang, 'coll.mergeDesc')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
              {playlists.filter((p) => p.id !== playlistId).map((p) => (
                <button key={p.id} className="ctx-item" onClick={() => { mergePlaylist(playlistId, p.id); setMergeOpen(false); }}>
                  <ListMusic size={16} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11.5 }}>{fmtCount(lang, p.tracks.length, p.tracks.length === 1 ? 'track' : 'tracks')}</span>
                </button>
              ))}
              {playlists.filter((p) => p.id !== playlistId).length === 0 && (
                <div className="ctx-empty">{t(lang, 'coll.noOtherPlaylists')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
