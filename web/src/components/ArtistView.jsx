import { useEffect, useState } from 'react';
import { Music2, Play, Shuffle, X, Clock } from 'lucide-react';
import usePlayer from '../store.js';
import { apiArtist } from '../lib/api.js';
import { formatTotalDuration, pluralize } from '../lib/format.js';
import TrackRow, { TrackListHeader } from './TrackRow.jsx';

export default function ArtistView({ artistId }) {
  const artist = usePlayer((s) => s.view?.name === 'artist' && s.view?.artistData ? s.view.artistData : null);
  const playTracks = usePlayer((s) => s.playTracks);
  const setView = usePlayer((s) => s.setView);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!artistId) return;
    const controller = new AbortController();
    apiArtist(artistId, { signal: controller.signal })
      .then((d) => setData(d))
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message || 'Failed to load artist.'); });
    return () => controller.abort();
  }, [artistId]);

  const tracks = data?.tracks || [];
  const title = data?.title || 'Artist';
  const meta = data?.meta ? `${data.meta}` : `${tracks.length} tracks`;

  if (error) {
    return (
      <div className="empty-state" style={{ padding: '60px 20px' }}>
        <X size={48} />
        <h3>Artist not found</h3>
        <p>{error}</p>
        <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setView({ name: 'home' })}>Go home</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state" style={{ padding: '60px 20px' }}>
        <Clock size={48} />
        <h3>Loading artist…</h3>
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
          <div className="hero-kicker">ARTIST</div>
          <h1 className="hero-title">{title}</h1>
          <div className="hero-meta">{meta}</div>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => playTracks(tracks, 0)} disabled={!tracks.length}>
              <Play size={17} fill="#fff" strokeWidth={0} /> Play
            </button>
            <button className="btn" onClick={() => playTracks(tracks, 0, { shuffle: true })} disabled={!tracks.length}>
              <Shuffle size={16} /> Shuffle
            </button>
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 16px' }}>
          <Music2 />
          <h3>No tracks found</h3>
          <p>This artist doesn’t have any tracks available right now.</p>
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
