import { useState } from 'react';
import { X, GripVertical, ListMusic, Trash2, BookmarkPlus, Play, Search } from 'lucide-react';
import usePlayer from '../store.js';
import { formatTime, formatTotalDuration } from '../lib/format.js';
import { t } from '../lib/i18n.js';

/**
 * Up-next queue — drag to reorder, remove individual tracks, clear the
 * queue, or snapshot it as a new playlist. Current track shows an
 * animated equalizer.
 */
export default function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const toggleQueue = usePlayer((s) => s.toggleQueue);
  const playIndex = usePlayer((s) => s.playIndex);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const reorderQueue = usePlayer((s) => s.reorderQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const saveQueueAsPlaylist = usePlayer((s) => s.saveQueueAsPlaylist);
  const queueDurationFormatted = usePlayer((s) => s.queueDurationFormatted());
  const lang = usePlayer((s) => s.settings.lang || 'en');

  const [dragFrom, setDragFrom] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [filter, setFilter] = useState('');

  const upNextCount = Math.max(0, queue.length - index - 1);
  const needle = filter.trim().toLowerCase();
  const visible = queue.map((track, i) => ({ track, i })).filter(({ track }) =>
    !needle || String(track.title || '').toLowerCase().includes(needle) || String(track.artist || '').toLowerCase().includes(needle),
  );
  const filtering = needle.length > 0;

  return (
    <section className="queue-panel" aria-label="Play queue">
      <div className="queue-head">
        <div>
          <h3>{t(lang, 'queue.title')}</h3>
          <small>{filtering ? `${visible.length} of ${queue.length} tracks` : `${queue.length} ${queue.length === 1 ? 'track' : 'tracks'}`}{index >= 0 ? ` · ${upNextCount} to play` : ''} · {queue.length > 0 ? queueDurationFormatted : ''}</small>
        </div>
        <div className="queue-actions">
          <button className="icon-btn" onClick={clearQueue} title="Clear queue" aria-label="Clear queue" disabled={!queue.length}>
            <Trash2 size={18} />
          </button>
          <button className="icon-btn" onClick={() => toggleQueue(false)} title="Close queue (Q)" aria-label="Close queue">
            <X size={20} />
          </button>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="queue-search">
          <Search size={15} />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter queue…"
            aria-label="Filter queue"
            autoComplete="off"
            spellCheck="false"
          />
          {filter && (
            <button className="icon-btn" onClick={() => setFilter('')} aria-label="Clear filter" title="Clear filter">
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 16px' }}>
          <ListMusic />
          <h3>{t(lang, 'queue.empty')}</h3>
          <p>Play a song and it will show up here. Right-click any track to add it to the queue.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 16px' }}>
          <Search />
          <h3>No matches</h3>
          <p>No tracks match “{filter.trim()}”.</p>
        </div>
      ) : (
        <div className="queue-list" role="list">
          {visible.map(({ track, i }) => {
            const active = i === index;
            const cls = ['queue-item'];
            if (active) cls.push('active');
            if (dragFrom === i) cls.push('dragging');
            if (dropTarget === i && dragFrom !== i) cls.push('drop-target');
            return (
              <div
                key={`${track.id}-${i}`}
                className={cls.join(' ')}
                role="listitem"
                draggable={!filtering}
                title={filtering ? 'Clear the filter to reorder' : 'Drag to reorder'}
                onDragStart={(e) => {
                  setDragFrom(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(i));
                }}
                onDragEnd={() => { setDragFrom(null); setDropTarget(null); }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropTarget !== i) setDropTarget(i); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom ?? Number(e.dataTransfer.getData('text/plain'));
                  if (Number.isInteger(from)) reorderQueue(from, i);
                  setDragFrom(null);
                  setDropTarget(null);
                }}
              >
                <span className="qi-grip" title="Drag to reorder" aria-hidden="true">
                  {active ? (
                    <span className={`eq${isPlaying ? '' : ' paused'}`}><span /><span /><span /><span /></span>
                  ) : (
                    <GripVertical size={16} />
                  )}
                </span>
                <img className="qi-art" src={track.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"
                     onClick={() => playIndex(i)} style={{ cursor: 'pointer' }} />
                <div className="qi-main" onClick={() => playIndex(i)} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
                     onKeyDown={(e) => e.key === 'Enter' && playIndex(i)} aria-label={`Play ${track.title}`}>
                  <div className="qi-title">{track.title}</div>
                  <div className="qi-artist">{track.artist || 'Unknown artist'}{track.duration ? ` · ${formatTime(track.duration)}` : ''}</div>
                </div>
                <button className="qi-remove" onClick={() => removeFromQueue(i)} aria-label="Remove from queue" title="Remove">
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="queue-foot">
        <button className="btn" onClick={saveQueueAsPlaylist} disabled={!queue.length} title="Save the current queue as a new playlist">
          <BookmarkPlus size={16} /> Save as playlist
        </button>
        <button className="btn" onClick={() => index >= 0 && playIndex(index)} disabled={index < 0} title="Replay current track">
          <Play size={15} fill="currentColor" /> Replay
        </button>
      </div>
    </section>
  );
}
