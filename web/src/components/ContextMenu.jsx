import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Play, ListPlus, ListStart, Heart, ListMusic, Trash2, Search, Check, Plus, ChevronRight, Download, Loader2, ListOrdered,
} from 'lucide-react';
import usePlayer from '../store.js';
import { apiChapters } from '../lib/api.js';
import { t } from '../lib/i18n.js';

/**
 * Right-click menu for any track: play now / next / later, like,
 * add to playlist (submenu), remove from playlist (when in one),
 * jump to artist search. Positioned and clamped to the viewport.
 */
export default function ContextMenu() {
  const menu = usePlayer((s) => s.menu);
  const closeMenu = usePlayer((s) => s.closeMenu);
  const playTrack = usePlayer((s) => s.playTrack);
  const playNextInQueue = usePlayer((s) => s.playNextInQueue);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const toggleLike = usePlayer((s) => s.toggleLike);
  const isLiked = usePlayer((s) => s.liked.some((t) => t?.id === menu?.track?.id));
  const playlists = usePlayer((s) => s.playlists);
  const addToPlaylist = usePlayer((s) => s.addToPlaylist);
  const removeFromPlaylist = usePlayer((s) => s.removeFromPlaylist);
  const createPlaylist = usePlayer((s) => s.createPlaylist);
  const searchFor = usePlayer((s) => s.searchFor);
  const setView = usePlayer((s) => s.setView);
  const downloadTrack = usePlayer((s) => s.downloadTrack);
  const removeOfflineTrack = usePlayer((s) => s.removeOfflineTrack);
  const offlineIds = usePlayer((s) => s.offlineIds);
  const downloadingIds = usePlayer((s) => s.downloadingIds);
  const downloadProgress = usePlayer((s) => s.downloadProgress);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  const toast = usePlayer((s) => s.toast);
  const playTrackForChapter = usePlayer((s) => s.playTrack);
  const [chapterBusy, setChapterBusy] = useState(false);

  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [subOpen, setSubOpen] = useState(false);

  useLayoutEffect(() => {
    if (!menu) return;
    setSubOpen(false);
    const el = ref.current;
    if (!el) { setPos({ x: menu.x, y: menu.y }); return; }
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const x = Math.min(Math.max(margin, menu.x), window.innerWidth - rect.width - margin);
    const y = Math.min(Math.max(margin, menu.y), window.innerHeight - rect.height - margin);
    setPos({ x, y });
  }, [menu]);

  useEffect(() => {
    if (!menu) return undefined;
    const onPointerDown = (e) => { if (!ref.current?.contains(e.target)) closeMenu(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } };
    const onWheel = (e) => { if (!ref.current?.contains(e.target)) closeMenu(); };
    const onResize = () => closeMenu();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }, [menu, closeMenu]);

  if (!menu?.track) return null;
  const { track, contextList, playlistId } = menu;
  const act = (fn) => () => { fn(); closeMenu(); };

  return (
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      aria-label={`Actions for ${track.title}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="ctx-label" style={{ maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {track.title}
      </div>

      <button className="ctx-item" role="menuitem" onClick={act(() => playTrack(track, contextList))}>
        <Play size={17} fill="currentColor" strokeWidth={0} /> {t(lang, 'ctx.playNow')}
      </button>
      <button className="ctx-item" role="menuitem" onClick={act(() => playNextInQueue(track))}>
        <ListStart size={17} /> {t(lang, 'ctx.playNext')}
      </button>
      <button className="ctx-item" role="menuitem" onClick={act(() => addToQueue(track))}>
        <ListPlus size={17} /> {t(lang, 'ctx.addQueue')}
      </button>

      <div className="ctx-sep" />

      <button className="ctx-item" role="menuitem" onClick={act(() => toggleLike(track))}>
        <Heart size={17} fill={isLiked ? 'var(--accent)' : 'none'} color={isLiked ? 'var(--accent)' : undefined} />
        {isLiked ? t(lang, 'ctx.unlike') : t(lang, 'ctx.like')}
      </button>

      {!track.isAddon && track.id && (
        <button
          className="ctx-item"
          role="menuitem"
          disabled={chapterBusy}
          onClick={async () => {
            setChapterBusy(true);
            closeMenu();
            try {
              const data = await apiChapters(track.id);
              const chapters = data?.chapters || [];
              if (!chapters.length) { toast('No chapters', `“${track.title}” has no chapters.`); return; }
              toast('Chapters · ' + chapters.length, chapters.slice(0, 5).map((c) => c.title).join(' · ') + (chapters.length > 5 ? ' · +' + (chapters.length - 5) : ''));
            } catch (e) {
              toast('Chapters failed', e.message || 'Could not load chapters.');
            } finally {
              setChapterBusy(false);
            }
          }}
        >
          <ListOrdered size={17} /> {chapterBusy ? t(lang, 'ctx.downloading') : t(lang, 'ctx.viewChapters')}
        </button>
      )}

      {(() => {
        const downloading = downloadingIds.includes(track.id);
        const downloaded = offlineIds.includes(track.id);
        const progress = downloadProgress?.id === track.id ? downloadProgress.pct : null;
        if (downloading) {
          return (
            <button className="ctx-item" disabled aria-disabled="true">
              <Loader2 size={17} style={{ animation: 'spin .8s linear infinite' }} />
              {t(lang, 'ctx.downloading')}
              {progress != null ? ` ${Math.round(progress * 100)}%` : ''}
            </button>
          );
        }
        if (downloaded) {
          return (
            <button className="ctx-item" role="menuitem" onClick={act(() => removeOfflineTrack(track.id))}>
              <Check size={17} color="var(--accent)" /> {t(lang, 'ctx.downloadedRemove')}
            </button>
          );
        }
        return (
          <button className="ctx-item" role="menuitem" onClick={act(() => downloadTrack(track))}>
            <Download size={17} /> {t(lang, 'ctx.download')}
          </button>
        );
      })()}

      {/* add-to-playlist submenu */}
      <div
        onMouseEnter={() => setSubOpen(true)}
        onMouseLeave={() => setSubOpen(false)}
      >
        <button
          className="ctx-item"
          role="menuitem"
          aria-haspopup="true"
          aria-expanded={subOpen}
          onClick={() => setSubOpen((v) => !v)}
        >
          <ListMusic size={17} /> {t(lang, 'ctx.addPlaylist')}
          <ChevronRight size={15} style={{ marginLeft: 'auto' }} />
        </button>
        {subOpen && (
          <div className="ctx-sub" role="menu" aria-label="Choose a playlist">
            <button
              className="ctx-item"
              onClick={act(() => {
                const p = createPlaylist(`${t(lang, 'lib.newPlaylist')} ${playlists.length + 1}`);
                addToPlaylist(p.id, track);
                setView({ name: 'playlist', id: p.id });
              })}
            >
              <Plus size={17} /> {t(lang, 'ctx.newPlaylist')}
            </button>
            {playlists.length > 0 && <div className="ctx-sep" />}
            {playlists.map((p) => {
              const contains = p.tracks.some((t) => t.id === track.id);
              return (
                <button key={p.id} className="ctx-item" onClick={act(() => addToPlaylist(p.id, track))}>
                  <span className="check-slot" style={{ width: 17, display: 'grid', placeItems: 'center' }}>
                    {contains && <Check size={15} strokeWidth={3} />}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{p.name}</span>
                </button>
              );
            })}
            {playlists.length === 0 && <div className="ctx-empty">{t(lang, 'ctx.noPlaylists')}</div>}
          </div>
        )}
      </div>

      {playlistId && (
        <button className="ctx-item danger" role="menuitem" onClick={act(() => removeFromPlaylist(playlistId, track.id))}>
          <Trash2 size={17} /> {t(lang, 'ctx.removePlaylist')}
        </button>
      )}

      <div className="ctx-sep" />

      <button className="ctx-item" role="menuitem" onClick={act(() => track.artist && searchFor(track.artist))}>
        <Search size={17} /> {t(lang, 'ctx.searchArtist')} “{(track.artist || 'artist').slice(0, 34)}”
      </button>
    </div>
  );
}
