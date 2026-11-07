import { memo } from 'react';
import { Heart, MoreHorizontal, Play, Pause } from 'lucide-react';
import usePlayer from '../store.js';
import { formatTime, shortQuality } from '../lib/format.js';

/**
 * A single track row. Click to play; buttons for like/more; when it is the
 * active track it shows an animated equalizer instead of its index.
 */
function TrackRow({ track, index, contextList, playlistId, showArt = true }) {
  const active = usePlayer((s) => s.index >= 0 && s.queue[s.index]?.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const liked = usePlayer((s) => s.liked.some((t) => t.id === track.id));
  const playTrack = usePlayer((s) => s.playTrack);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleLike = usePlayer((s) => s.toggleLike);
  const openMenu = usePlayer((s) => s.openMenu);

  const handlePlay = () => (active ? togglePlay() : playTrack(track, contextList));

  return (
    <div
      className={`track-row${active ? ' active' : ''}`}
      onDoubleClick={handlePlay}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu({ x: e.clientX, y: e.clientY, track, contextList, playlistId });
      }}
      role="row"
      aria-label={`${track.title} by ${track.artist || 'Unknown artist'}`}
    >
      <div className="tr-index">
        {active ? (
          <span className={`eq${isPlaying ? '' : ' paused'}`} aria-hidden="true">
            <span /><span /><span /><span />
          </span>
        ) : (
          <>
            <span className="tr-num">{index + 1}</span>
            <button className="tr-play-mini" onClick={handlePlay} aria-label="Play">
              <Play size={17} fill="currentColor" />
            </button>
          </>
        )}
      </div>

      {showArt && (
        <img className="tr-art" src={track.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
      )}

      <div className="tr-main">
        <div className="tr-title">{track.title}</div>
        <div className="tr-artist">
          {track.artist || 'Unknown artist'}
          {track.kind === 'video' ? ' · Video' : ''}
          {track.isAddon && <span className="hq-badge">{shortQuality(track.audioQuality)}</span>}
        </div>
      </div>

      <div className="tr-time">{track.duration ? formatTime(track.duration) : '—'}</div>

      <div className="tr-actions">
        <button
          className={`icon-btn like-btn${liked ? ' liked' : ''}`}
          onClick={() => toggleLike(track)}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
          title={liked ? 'Unlike' : 'Like'}
        >
          <Heart size={17} strokeWidth={2} />
        </button>
        <button
          className="icon-btn"
          onClick={(e) => openMenu({ x: e.clientX, y: e.clientY, track, contextList, playlistId })}
          aria-label="More options"
          title="More options"
        >
          <MoreHorizontal size={18} />
        </button>
        <button className="icon-btn" onClick={handlePlay} aria-label={active && isPlaying ? 'Pause' : 'Play'} title={active && isPlaying ? 'Pause' : 'Play'}>
          {active && isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
      </div>
    </div>
  );
}

export const TrackListHeader = () => (
  <div className="track-list-header" aria-hidden="true">
    <span>#</span>
    <span />
    <span>TITLE</span>
    <span>TIME</span>
    <span />
  </div>
);

export default memo(TrackRow);
