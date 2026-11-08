import { X, Keyboard } from 'lucide-react';
import usePlayer from '../store.js';
import { t } from '../lib/i18n.js';

const GROUPS = [
  {
    groupKey: 'shortcuts.gPlayback',
    items: [
      [['Space', 'K'], 'kbd.playPause'],
      [['N'], 'player.next'],
      [['P'], 'player.prev'],
      [['←'], 'kbd.seekBack'],
      [['→'], 'kbd.seekFwd'],
      [['↑', '↓'], 'kbd.volume'],
      [['M'], 'kbd.mute'],
    ],
  },
  {
    groupKey: 'shortcuts.gViews',
    items: [
      [['Ctrl', 'K'], 'kbd.search'],
      [['L'], 'kbd.lyrics'],
      [['C'], 'kbd.karaoke'],
      [['Q'], 'kbd.queue'],
      [['F'], 'kbd.nowPlaying'],
      [['Esc'], 'kbd.close'],
    ],
  },
  {
    groupKey: 'shortcuts.gHelp',
    items: [
      [['?'], 'shortcuts.self'],
    ],
  },
];

export default function ShortcutsHelp() {
  const open = usePlayer((s) => s.shortcutsOpen);
  const setShortcutsOpen = usePlayer((s) => s.setShortcutsOpen);
  const lang = usePlayer((s) => s.settings.lang || 'en');
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setShortcutsOpen(false)} role="presentation" style={{ zIndex: 120 }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(lang, 'shortcuts.title')}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Keyboard size={20} aria-hidden="true" />
          <h2 style={{ margin: 0 }}>{t(lang, 'shortcuts.title')}</h2>
          <button className="icon-btn" onClick={() => setShortcutsOpen(false)} aria-label={t(lang, 'btn.close')} style={{ marginLeft: 'auto' }}>
            <X size={20} />
          </button>
        </div>
        {GROUPS.map((group) => (
          <div key={group.groupKey} style={{ marginTop: 14 }}>
            <div className="ctx-label" style={{ marginBottom: 8 }}>{t(lang, group.groupKey)}</div>
            {group.items.map(([keys, labelKey]) => (
              <div
                key={`${group.groupKey}-${labelKey}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--stroke)' }}
              >
                <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {keys.map((k) => <kbd className="kbd" key={k}>{k}</kbd>)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{t(lang, labelKey)}</span>
              </div>
            ))}
          </div>
        ))}
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
          {t(lang, 'shortcuts.note')}
        </p>
      </div>
    </div>
  );
}
