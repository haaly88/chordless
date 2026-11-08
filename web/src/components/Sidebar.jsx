import { useEffect, useRef, useState } from 'react';
import { Home, Search, Heart, Plus, Music2, Check, X, Library, BarChart3, Settings, Moon, Sun, ListPlus, Folder, ChevronRight, Trash2, Download } from 'lucide-react';
import usePlayer from '../store.js';
import { t } from '../lib/i18n.js';

function PlaylistArt({ playlist }) {
  const covers = [...new Set(playlist.tracks.map((t) => t.thumbnail).filter(Boolean))].slice(0, 4);
  if (covers.length === 0) {
    return (
      <div className="lib-art playlist-empty">
        <Music2 size={20} />
      </div>
    );
  }
  if (covers.length === 1) {
    return (
      <div className="lib-art">
        <img src={covers[0]} alt="" loading="lazy" referrerPolicy="no-referrer" />
      </div>
    );
  }
  return (
    <div className="lib-art">
      <div className="mosaic">
        {covers.map((c) => (
          <img key={c} src={c} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({ open = false, onClose }) {
  const view = usePlayer((s) => s.view);
  const setView = usePlayer((s) => s.setView);
  const likedCount = usePlayer((s) => s.liked.length);
  const playlists = usePlayer((s) => s.playlists);
  const folders = usePlayer((s) => s.folders);
  const createPlaylist = usePlayer((s) => s.createPlaylist);
  const createFolder = usePlayer((s) => s.createFolder);
  const deleteFolder = usePlayer((s) => s.deleteFolder);
  const setSettingsOpen = usePlayer((s) => s.setSettingsOpen);
  const theme = usePlayer((s) => s.settings.theme);
  const updateSettings = usePlayer((s) => s.updateSettings);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  const installAvailable = usePlayer((s) => s.installAvailable);
  const promptInstall = usePlayer((s) => s.promptInstall);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [folderCreating, setFolderCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [openFolders, setOpenFolders] = useState({});
  const inputRef = useRef(null);
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const onChange = () => setIsSmall(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // close the mobile drawer whenever the route changes
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const submitCreate = () => {
    const trimmed = name.trim();
    if (trimmed) {
      const p = createPlaylist(trimmed);
      setView({ name: 'playlist', id: p.id });
    }
    setCreating(false);
    setName('');
  };

  const submitFolder = () => {
    const trimmed = folderName.trim();
    if (trimmed) {
      const f = createFolder(trimmed);
      if (f) setOpenFolders((m) => ({ ...m, [f.id]: true }));
    }
    setFolderCreating(false);
    setFolderName('');
  };

  const nav = [
    { id: 'home', label: t(lang, 'nav.home'), Icon: Home },
    { id: 'search', label: t(lang, 'nav.search'), Icon: Search },
    { id: 'library', label: t(lang, 'nav.library'), Icon: Library },
    { id: 'stats', label: t(lang, 'nav.stats'), Icon: BarChart3 },
  ];

  const isActive = (id) =>
    view?.name === id ||
    (id === 'library' && (view?.name === 'liked' || view?.name === 'playlist')) ||
    (id === 'stats' && view?.name === 'stats');

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Sidebar" aria-hidden={isSmall && !open ? 'true' : undefined} inert={isSmall && !open ? '' : undefined}>
      {/* wordmark row with theme toggle */}
      <div className="sb-top">
        <button className="logo" onClick={() => setView({ name: 'home' })} aria-label="Chordless — Home">
          <div className="logo-mark" aria-hidden="true">
            <img src="/icon.png" alt="" width="64" height="64" />
          </div>
          <div className="logo-name">Chordless<span>MUSIC</span></div>
        </button>
        <button
          className="icon-btn"
          onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>

      {/* primary nav */}
      <nav className="nav" aria-label="Primary">
        {nav.map(({ id, label, Icon }) => (
          <button key={id} className={`nav-item${isActive(id) ? ' active' : ''}`} onClick={() => setView({ name: id })}>
            <Icon aria-hidden="true" /><span className="txt">{label}</span>
          </button>
        ))}
        <button className="nav-item" onClick={() => setSettingsOpen(true)}>
          <Settings aria-hidden="true" /><span className="txt">{t(lang, 'nav.settings')}</span>
        </button>
      </nav>

      {/* new playlist pill */}
      <button className="new-playlist-pill" onClick={() => setCreating((v) => !v)} aria-label="Create playlist">
        {creating ? <X size={17} /> : <Plus size={17} strokeWidth={2.4} />}
        {creating ? 'Cancel' : t(lang, 'home.shortcut.newPlaylist')}
      </button>
      <button className="new-playlist-pill" style={{ height: 36, marginTop: -6 }} onClick={() => setFolderCreating((v) => !v)} aria-label="Create folder">
        <Folder size={15} /> {folderCreating ? 'Cancel' : t(lang, 'home.shortcut.newFolder')}
      </button>
      {installAvailable && (
        <button className="new-playlist-pill" style={{ height: 36, marginTop: -6 }} onClick={() => promptInstall()} aria-label="Install app">
          <Download size={15} /> Install app
        </button>
      )}

      {folderCreating && (
        <div className="create-row" style={{ display: 'flex', gap: 6, padding: '2px 10px 8px' }}>
          <input
            className="field"
            style={{ height: 38, fontSize: 13 }}
            placeholder="Folder name…"
            value={folderName}
            maxLength={60}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitFolder();
              if (e.key === 'Escape') { setFolderCreating(false); setFolderName(''); }
            }}
            aria-label="New folder name"
            autoFocus
          />
          <button className="icon-btn accent" onClick={submitFolder} aria-label="Create folder" title="Create">
            <Check size={20} />
          </button>
        </div>
      )}

      {creating && (
        <div className="create-row" style={{ display: 'flex', gap: 6, padding: '2px 10px 8px' }}>
          <input
            ref={inputRef}
            className="field"
            style={{ height: 38, fontSize: 13 }}
            placeholder="Playlist name…"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') { setCreating(false); setName(''); }
            }}
            aria-label="New playlist name"
          />
          <button className="icon-btn accent" onClick={submitCreate} aria-label="Create" title="Create">
            <Check size={20} />
          </button>
        </div>
      )}

      {/* playlists */}
      <div className="lib-scroll" role="list">
        <button className={`lib-item${view?.name === 'liked' ? ' active' : ''}`} onClick={() => setView({ name: 'liked' })}>
          <div className="lib-art liked">
            <Heart aria-hidden="true" size={20} />
          </div>
          <div className="lib-meta">
            <b>{t(lang, 'home.shortcut.likedSongs')}</b>
            <small>{likedCount} {t(lang, 'home.likedSub')}</small>
          </div>
        </button>

        {folders.map((f) => {
          const inFolder = playlists.filter((p) => p.folderId === f.id);
          const isOpen = Boolean(openFolders[f.id]);
          return (
            <div key={f.id}>
              <div className="lib-item" role="button" tabIndex={0} onClick={() => setOpenFolders((m) => ({ ...m, [f.id]: !m[f.id] }))} onKeyDown={(e) => e.key === 'Enter' && setOpenFolders((m) => ({ ...m, [f.id]: !m[f.id] }))} aria-expanded={isOpen} title={`${f.name} — ${inFolder.length} playlists`}>
                <div className="lib-art playlist-empty"><Folder size={20} /></div>
                <div className="lib-meta"><b>{f.name}</b><small>{inFolder.length} {inFolder.length === 1 ? 'playlist' : 'playlists'}</small></div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><ChevronRight size={15} /></span>
              </div>
              {isOpen && inFolder.map((p) => (
                <button key={p.id} className={`lib-item${view?.name === 'playlist' && view?.id === p.id ? ' active' : ''}`} style={{ paddingLeft: 22 }} onClick={() => setView({ name: 'playlist', id: p.id })}>
                  <PlaylistArt playlist={p} />
                  <div className="lib-meta"><b>{p.name}</b><small>{p.tracks.length} {p.tracks.length === 1 ? 'track' : 'tracks'}</small></div>
                </button>
              ))}
              {isOpen && (
                <button className="lib-item" style={{ paddingLeft: 22, opacity: .65 }} onClick={() => deleteFolder(f.id)} title="Delete folder (playlists become unfiled)">
                  <span style={{ width: 44, display: 'grid', placeItems: 'center', color: '#ff8a8a' }}><Trash2 size={16} /></span>
                  <div className="lib-meta"><b>Delete folder</b></div>
                </button>
              )}
            </div>
          );
        })}

        {playlists.filter((p) => !p.folderId).map((p) => (
          <button key={p.id} className={`lib-item${view?.name === 'playlist' && view?.id === p.id ? ' active' : ''}`} onClick={() => setView({ name: 'playlist', id: p.id })}>
            <PlaylistArt playlist={p} />
            <div className="lib-meta">
              <b>{p.name}</b>
              <small>{p.tracks.length} {p.tracks.length === 1 ? 'track' : 'tracks'}</small>
            </div>
          </button>
        ))}

        {playlists.length === 0 && !creating && (
          <div className="foot-note" style={{ padding: '6px 12px' }}>
            {t(lang, 'home.noPlaylists')}<br />Press <ListPlus size={11} style={{ verticalAlign: '-1px' }} /> create yours.
          </div>
        )}
      </div>

      {/* slim footer */}
      <div className="sidebar-foot" style={{ justifyContent: 'center' }}>
        <span className="foot-note" style={{ textAlign: 'center' }}>Chordless · personal music</span>
      </div>
    </aside>
  );
}
