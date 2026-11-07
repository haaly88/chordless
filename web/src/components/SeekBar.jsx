import { useCallback, useRef, useState } from 'react';

/**
 * Pointer-based seek bar (click / drag). Used by the player bar and
 * the fullscreen Now Playing view.
 */
export default function SeekBar({ value, duration, onSeek, ariaLabel = 'Seek' }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const frac = duration > 0 ? Math.min(1, Math.max(0, value / duration)) : 0;

  const fracFromEvent = useCallback((clientX) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onSeek(fracFromEvent(e.clientX) * duration, true);
  };
  const handlePointerMove = (e) => {
    if (!dragging) return;
    onSeek(fracFromEvent(e.clientX) * duration, true);
  };
  const handlePointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onSeek(fracFromEvent(e.clientX) * duration, false);
  };

  return (
    <div
      className={`seekbar${dragging ? ' dragging' : ''}`}
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration || 0)}
      aria-valuenow={Math.floor(value || 0)}
      aria-valuetext={`${Math.floor(value || 0)} seconds`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, value - 5), false); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(duration, value + 5), false); }
      }}
    >
      <div className="seekbar-track">
        <div className="seekbar-fill" style={{ width: `${frac * 100}%` }} />
        <div className="seekbar-knob" style={{ left: `${frac * 100}%` }} />
      </div>
    </div>
  );
}
