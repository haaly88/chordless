import { X, Keyboard } from 'lucide-react';
import usePlayer from '../store.js';

const GROUPS = [
  {
    title: 'Playback',
    items: [
      [['Space', 'K'], 'Play / Pause'],
      [['N'], 'Next track'],
      [['P'], 'Previous track'],
      [['←'], 'Back 5 seconds'],
      [['→'], 'Forward 5 seconds'],
      [['↑', '↓'], 'Volume up / down'],
      [['M'], 'Mute'],
    ],
  },
  {
    title: 'Views',
    items: [
      [['Ctrl', 'K'], 'Go to Search'],
      [['L'], 'Toggle lyrics'],
      [['C'], 'Karaoke mode'],
      [['Q'], 'Queue'],
      [['F'], 'Now Playing (fullscreen)'],
      [['Esc'], 'Close panel / dialog'],
    ],
  },
  {
    title: 'Help',
    items: [
      [['?'], 'This shortcuts panel'],
    ],
  },
];

export default function ShortcutsHelp() {
  const open = usePlayer((s) => s.shortcutsOpen);
  const setShortcutsOpen = usePlayer((s) => s.setShortcutsOpen);
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setShortcutsOpen(false)} role="presentation" style={{ zIndex: 120 }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Keyboard size={20} aria-hidden="true" />
          <h2 style={{ margin: 0 }}>Keyboard shortcuts</h2>
          <button className="icon-btn" onClick={() => setShortcutsOpen(false)} aria-label="Close shortcuts" style={{ marginLeft: 'auto' }}>
            <X size={20} />
          </button>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title} style={{ marginTop: 14 }}>
            <div className="ctx-label" style={{ marginBottom: 8 }}>{group.title}</div>
            {group.items.map(([keys, label]) => (
              <div
                key={`${group.title}-${label}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--stroke)' }}
              >
                <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {keys.map((k) => <kbd className="kbd" key={k}>{k}</kbd>)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
              </div>
            ))}
          </div>
        ))}
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
          Shortcuts pause while you type in a field. Press <kbd className="kbd">?</kbd> anytime to reopen this panel.
        </p>
      </div>
    </div>
  );
}
