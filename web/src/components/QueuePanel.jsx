import { useEffect, useRef, useState } from 'react';
import { X, GripVertical, ListMusic, Trash2, BookmarkPlus, Play, Search } from 'lucide-react';
import usePlayer from '../store.js';
import { formatTime } from '../lib/format.js';
import { t, fmtCount } from '../lib/i18n.js';

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
  const listRef = useRef(null);
  const activeRowRef = useRef(null);

  useEffect(() => {
    // Keep the playing track visible when the panel opens or the track changes.
    activeRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [index === 0 ? '' : index]);

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
          <small>{filtering ? t(lang, 'queue.ofTracks').replace('{v}', visible.length).replace('{q}', queue.length) : fmtCount(lang, queue.length, queue.length === 1 ? 'track' : 'tracks')}{index >= 0 ? ` · ${t(lang, 'queue.toPlay').replace('{n}', upNextCount)}` : ''} · {queue.length > 0 ? queueDurationFormatted : ''}</small>
        </div>
        <div className="queue-actions">
          <button className="icon-btn" onClick={clearQueue} title={t(lang, 'queue.clear')} aria-label={t(lang, 'queue.clear')} disabled={!queue.length}>
            <Trash2 size={18} />
          </button>
          <button className="icon-btn" onClick={() => toggleQueue(false)} title={t(lang, 'queue.close')} aria-label={t(lang, 'queue.close')}>
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
            placeholder={t(lang, 'queue.filter')}
            aria-label={t(lang, 'queue.filter')}
            autoComplete="off"
            spellCheck="false"
          />
          {filter && (
            <button className="icon-btn" onClick={() => setFilter('')} aria-label={t(lang, 'btn.clear')} title={t(lang, 'btn.clear')}>
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 16px' }}>
          <ListMusic />
          <h3>{t(lang, 'queue.empty')}</h3>
          <p>{t(lang, 'queue.emptyHint')}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 16px' }}>
          <Search />
          <h3>{t(lang, 'queue.noMatches')}</h3>
          <p>{t(lang, 'queue.noMatchesSub').replace('{q}', filter.trim())}</p>
        </div>
      ) : (
        <div className="queue-list" role="list" ref={listRef}>
          {visible.map(({ track, i }) => {
            const active = i === index;
            const cls = ['queue-item'];
            if (active) cls.push('active');
            if (dragFrom === i) cls.push('dragging');
            if (dropTarget === i && dragFrom !== i) cls.push('drop-target');
            return (
              <div
                key={`${track.id}-${i}`}
                ref={active ? activeRowRef : null}
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
                  <div className="qi-artist">{track.artist || t(lang, 'common.unknownArtist')}{track.duration ? ` · ${formatTime(track.duration)}` : ''}</div>
                </div>
                <button className="qi-remove" onClick={() => removeFromQueue(i)} aria-label={t(lang, 'btn.remove')} title={t(lang, 'btn.remove')}>
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="queue-foot">
        <button className="btn" onClick={saveQueueAsPlaylist} disabled={!queue.length} title={t(lang, 'queue.saveAsPlaylist')}>
          <BookmarkPlus size={16} /> {t(lang, 'queue.saveAsPlaylist')}
        </button>
        <button className="btn" onClick={() => index >= 0 && playIndex(index)} disabled={index < 0} title={t(lang, 'queue.replay')}>
          <Play size={15} fill="currentColor" /> {t(lang, 'queue.replay')}
        </button>
      </div>
    </section>
  );
}
