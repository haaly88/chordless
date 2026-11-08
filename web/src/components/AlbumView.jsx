import { useEffect, useState } from 'react';
import { Music2, Play, Shuffle, X, Clock } from 'lucide-react';
import usePlayer from '../store.js';
import { apiAlbum } from '../lib/api.js';
import { t, fmtCount } from '../lib/i18n.js';
import TrackRow, { TrackListHeader } from './TrackRow.jsx';

export default function AlbumView({ albumId }) {
  const playTracks = usePlayer((s) => s.playTracks);
  const setView = usePlayer((s) => s.setView);
  const lang = usePlayer((s) => s.settings.lang || 'en');

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!albumId) return;
    const controller = new AbortController();
    apiAlbum(albumId, { signal: controller.signal })
      .then((d) => setData(d))
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message || t(usePlayer.getState().settings.lang || 'en', 'album.notFound')); });
    return () => controller.abort();
  }, [albumId]);

  const tracks = data?.tracks || [];
  const title = data?.title || t(lang, 'search.albums');
  const meta = data?.meta ? `${data.meta}` : fmtCount(lang, tracks.length, tracks.length === 1 ? 'track' : 'tracks');

  if (error) {
    return (
      <div className="empty-state" style={{ padding: '60px 20px' }}>
        <X size={48} />
        <h3>{t(lang, 'album.notFound')}</h3>
        <p>{error}</p>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setView({ name: 'home' })}>{t(lang, 'common.goHome')}</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state" style={{ padding: '60px 20px' }}>
        <Clock size={48} />
        <h3>{t(lang, 'album.loading')}</h3>
      </div>
    );
  }

  return (
    <div>
      <div className="collection-hero">
        {data.thumbnail ? (
          <img className="hero-art" src={data.thumbnail} alt={`${title} artwork`} referrerPolicy="no-referrer" />
        ) : (
          <div className="hero-art playlist-fallback" style={{ width: 196, height: 196 }}>
            <Music2 size={84} strokeWidth={1.6} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="hero-kicker">{t(lang, 'album.kicker')}</div>
          <h1 className="hero-title">{title}</h1>
          <div className="hero-meta">{meta}</div>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => playTracks(tracks, 0)} disabled={!tracks.length}>
              <Play size={17} fill="#fff" strokeWidth={0} /> {t(lang, 'btn.play')}
            </button>
            <button className="btn" onClick={() => playTracks(tracks, 0, { shuffle: true })} disabled={!tracks.length}>
              <Shuffle size={16} /> {t(lang, 'btn.shuffle')}
            </button>
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 16px' }}>
          <Music2 />
          <h3>{t(lang, 'album.emptyTitle')}</h3>
          <p>{t(lang, 'album.emptyText')}</p>
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
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
