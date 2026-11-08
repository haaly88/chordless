import { useEffect, useState } from 'react';
import { Play, Shuffle, Music2, CloudOff, RotateCcw } from 'lucide-react';
import usePlayer from '../store.js';
import { apiPlaylist } from '../lib/api.js';
import { formatTotalDuration } from '../lib/format.js';
import { t, fmtCount } from '../lib/i18n.js';
import TrackRow, { TrackListHeader } from './TrackRow.jsx';

/** Remote YouTube playlist page loaded via /api/playlist. */
export default function YtPlaylistView({ playlistId }) {
  const playTracks = usePlayer((s) => s.playTracks);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!playlistId) return undefined;
    const controller = new AbortController();
    setData(null);
    setError(null);
    apiPlaylist(playlistId, { signal: controller.signal })
      .then(setData)
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message || 'Failed to load playlist'); });
    return () => controller.abort();
  }, [playlistId, retryTick]);

  if (error) {
    return (
      <div className="empty-state">
        <CloudOff />
        <h3>{t(lang, 'yt.loadError')}</h3>
        <p>{error}</p>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setRetryTick((n) => n + 1)}>
          <RotateCcw size={16} /> {t(lang, 'common.tryAgain')}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="collection-hero" aria-busy="true">
        <div className="skel" style={{ width: 216, height: 216, borderRadius: 18 }} />
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 14, width: 120, marginBottom: 14 }} />
          <div className="skel" style={{ height: 48, width: '70%', marginBottom: 14 }} />
          <div className="skel" style={{ height: 16, width: 220, marginBottom: 24 }} />
          <div className="skel" style={{ height: 44, width: 130, borderRadius: 99 }} />
        </div>
      </div>
    );
  }

  const { title, meta, thumbnail, tracks } = data;

  return (
    <div>
      <div className="collection-hero">
        {thumbnail ? (
          <img className="hero-art" src={thumbnail} alt={`${title} artwork`} referrerPolicy="no-referrer" />
        ) : (
          <div className="hero-art playlist-fallback"><Music2 strokeWidth={1.4} /></div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="hero-kicker">{t(lang, 'yt.kicker')}</div>
          <h1 className="hero-title">{title}</h1>
          <div className="hero-meta">{meta || fmtCount(lang, tracks.length, tracks.length === 1 ? 'track' : 'tracks')}</div>
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
        <div className="empty-state">
          <Music2 />
          <h3>{t(lang, 'yt.emptyTitle')}</h3>
          <p>{t(lang, 'yt.emptyText')}</p>
        </div>
      ) : (
        <>
          <TrackListHeader />
          <div role="rowgroup">
            {tracks.map((track, i) => (
              <TrackRow key={`${track.id}-${i}`} track={track} index={i} contextList={tracks} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
