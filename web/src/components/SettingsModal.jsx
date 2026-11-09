import { useEffect, useRef, useState } from 'react';
import { X, Moon, Sun, Trash2, Palette, Info, Keyboard, Heart, ExternalLink, Plug, Check, Loader2, Flame, Download, Upload, Monitor, RotateCcw, ChevronDown, Search, MapPin, Copy } from 'lucide-react';
import usePlayer from '../store.js';
import { apiAddonTest } from '../lib/api.js';
import { REGION_OPTIONS, resolveRegion } from '../lib/region.js';
import { t } from '../lib/i18n.js';

const REGION_FLAGS = {
  auto: '🌐', ID: '🇮🇩', MY: '🇲🇾', SG: '🇸🇬', TH: '🇹🇭', VN: '🇻🇳', PH: '🇵🇭', JP: '🇯🇵', KR: '🇰🇷',
  CN: '🇨🇳', HK: '🇭🇰', TW: '🇹🇼', IN: '🇮🇳', AE: '🇦🇪', AU: '🇦🇺', NZ: '🇳🇿', GB: '🇬🇧', US: '🇺🇸',
  CA: '🇨🇦', FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱', BR: '🇧🇷', MX: '🇲🇽', AR: '🇦🇷',
  EG: '🇪🇬', NG: '🇳🇬', ZA: '🇿🇦',
};

function SettingsDropdown({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const current = REGION_OPTIONS.find((o) => o.gl === value) || REGION_OPTIONS[0];
  const filtered = REGION_OPTIONS.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return o.label.toLowerCase().includes(q) || o.gl.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onEsc);
    setTimeout(() => inputRef.current?.focus(), 30);
    // Menu expands in-flow and pushes content down — scroll the modal so
    // the Region row sits near the top and the full list is visible.
    requestAnimationFrame(() => {
      const modal = wrapRef.current?.closest('.modal');
      const row = wrapRef.current?.closest('.setting-row');
      if (modal && row) {
        const modalRect = modal.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const delta = rowRect.top - modalRect.top - 16;
        if (delta > 0) modal.scrollTop += delta;
      }
    });
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  useEffect(() => { setActiveIdx(0); setQuery(''); }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelectorAll('[data-dd-item]')[activeIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open, filtered.length]);

  const choose = (o) => {
    onChange(o.gl);
    setOpen(false);
  };

  return (
    <div className={`settings-dd${open ? ' open' : ''}`} ref={wrapRef} style={{ width: 210, flexShrink: 0 }}>
      <button
        type="button"
        className={`settings-dd-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="settings-dd-flag">{REGION_FLAGS[current.gl] || '🌐'}</span>
        <span className="settings-dd-label">{current.label}</span>
        <span className="settings-dd-code">{current.gl === 'auto' ? 'AUTO' : current.gl}</span>
        <ChevronDown size={15} className={open ? 'settings-dd-chev open' : 'settings-dd-chev'} />
      </button>
      {open && (
        <div className="settings-dd-menu" role="listbox" aria-label={label}>
          <div className="settings-dd-search">
            <Search size={14} />
            <input
              ref={inputRef}
              className="settings-dd-input"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(filtered.length - 1, i + 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
                if (e.key === 'Enter' && filtered[activeIdx]) { e.preventDefault(); choose(filtered[activeIdx]); }
              }}
              placeholder="Search country or code…"
              aria-label="Search region"
            />
          </div>
          <div className="settings-dd-list" ref={listRef}>
            {filtered.length === 0 && (
              <div className="settings-dd-empty">No match for “{query}”</div>
            )}
            {filtered.map((o, i) => {
              const isActive = o.gl === value;
              return (
                <button
                  key={o.gl}
                  data-dd-item
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`settings-dd-item${isActive ? ' active' : ''}${i === activeIdx ? ' hovered' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => choose(o)}
                >
                  <span className="settings-dd-flag">{REGION_FLAGS[o.gl] || '🌐'}</span>
                  <span className="settings-dd-item-label">{o.label}</span>
                  <span className="settings-dd-code">{o.gl === 'auto' ? 'AUTO' : o.gl}</span>
                  <span className="settings-dd-check">{isActive && <Check size={15} strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsModal() {
  const settings = usePlayer((s) => s.settings);
  const lang = settings.lang || 'en';
  const updateSettings = usePlayer((s) => s.updateSettings);
  const setSettingsOpen = usePlayer((s) => s.setSettingsOpen);
  const clearHistory = usePlayer((s) => s.clearHistory);
  const historyCount = usePlayer((s) => s.history.length);
  const toast = usePlayer((s) => s.toast);
  const exportLibrary = usePlayer((s) => s.exportLibrary);
  const importLibrary = usePlayer((s) => s.importLibrary);
  const equalizerPreset = usePlayer((s) => s.equalizerPreset);
  const equalizerBands = usePlayer((s) => s.equalizerBands);
  const setEqualizerPreset = usePlayer((s) => s.setEqualizerPreset);
  const setEqualizerBand = usePlayer((s) => s.setEqualizerBand);
  const exportEQPreset = usePlayer((s) => s.exportEQPreset);
  const importEQPreset = usePlayer((s) => s.importEQPreset);
  const crossfade = settings.crossfade || { enabled: false, duration: 5 };
  const setCrossfade = usePlayer((s) => s.setCrossfade);
  const gapless = settings.gapless || { enabled: false, preloadSeconds: 20 };
  const setGapless = usePlayer((s) => s.setGapless);
  const gaplessStatus = usePlayer((s) => s.gaplessStatus);
  const spatial = settings.spatial || { enabled: false, width: 1.6 };
  const setSpatial = usePlayer((s) => s.setSpatial);
  const generateRadio = usePlayer((s) => s.generateRadio);
  const setYtQuality = usePlayer((s) => s.setYtQuality);
  const setNormalize = usePlayer((s) => s.setNormalize);
  const setBalance = usePlayer((s) => s.setBalance);
  const setAdaptiveQuality = usePlayer((s) => s.setAdaptiveQuality);
  const refreshNetworkInfo = usePlayer((s) => s.refreshNetworkInfo);
  const networkInfo = usePlayer((s) => s.networkInfo);
  const effectiveYtQuality = usePlayer((s) => s.effectiveYtQuality);
  const stallCount = usePlayer((s) => s.stallCount);
  const addons = settings.addons || [];
  const addAddon = usePlayer((s) => s.addAddon);
  const removeAddon = usePlayer((s) => s.removeAddon);
  const toggleAddon = usePlayer((s) => s.toggleAddon);
  const moveAddon = usePlayer((s) => s.moveAddon);
  const [resetArm, setResetArm] = useState(false);
  const [addonUrl, setAddonUrl] = useState('');
  const [addonTesting, setAddonTesting] = useState(false);
  const [addonStatus, setAddonStatus] = useState(null);
  const [remapFor, setRemapFor] = useState(null);
  const panelRef = useRef(null);
  const importRef = useRef(null);

  useEffect(() => {
    if (!remapFor) return undefined;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRemapFor(null); return; }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const keybinds = { ...settings.keybinds, [remapFor]: [key] };
      updateSettings({ keybinds });
      setRemapFor(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [remapFor, settings.keybinds, updateSettings]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setSettingsOpen(false); return; }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const list = [...focusable].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [setSettingsOpen]);

  const runAddonTest = async () => {
    const url = addonUrl.trim();
    if (!url) return;
    setAddonTesting(true);
    setAddonStatus(null);
    try {
      const result = await apiAddonTest(url);
      if (result.ok) {
        setAddonStatus({ ok: true, manifest: result.manifest });
        addAddon({ url, enabled: true, manifest: result.manifest });
        setAddonUrl('');
      } else {
        setAddonStatus({ ok: false, error: result.error || 'Invalid addon or unreachable.' });
      }
    } catch {
      setAddonStatus({ ok: false, error: 'Could not reach the addon — check the URL & connection.' });
    } finally {
      setAddonTesting(false);
    }
  };

  const resetAll = () => {
    Object.keys(localStorage).filter((k) => k.startsWith('cl:') || k.startsWith('bc:')).forEach((k) => localStorage.removeItem(k));
    toast('App data cleared', 'Reloading…');
    setTimeout(() => window.location.reload(), 600);
  };

  const shortcuts = [
    ['Space / K', 'kbd.playPause'],
    ['← / →', 'kbd.seek'],
    ['↑ / ↓', 'kbd.volume'],
    ['N / P', 'kbd.nextPrev'],
    ['L', 'kbd.lyrics'],
    ['Q', 'kbd.queue'],
    ['F', 'kbd.nowPlaying'],
    ['M', 'kbd.mute'],
    ['Ctrl / ⌘ + K', 'kbd.search'],
    ['Esc', 'kbd.close'],
    ['Right-click', 'kbd.rightClick'],
    ['Double-click', 'kbd.doubleClick'],
  ];

  return (
    <div className="modal-backdrop" onClick={() => setSettingsOpen(false)} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{t(lang, 'settings.titleVisible')}</h2>
          <button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        {/* theme */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.appearance')}</b>
            <small>{t(lang, 'settings.desc.appearance')}</small>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Theme" style={{ flexWrap: 'wrap' }}>
            {[
              ['dark', <><Moon size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t(lang, 'settings.themeDark')}</>],
              ['light', <><Sun size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t(lang, 'settings.themeLight')}</>],
              ['system', <><Monitor size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t(lang, 'settings.themeSystem')}</>],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={settings.theme === value}
                className={settings.theme === value ? 'active' : ''}
                onClick={() => updateSettings({ theme: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* language */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.lang')}</b>
            <small>{t(lang, 'settings.desc.lang')}</small>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Language" style={{ flexWrap: 'wrap' }}>
            {[
              ['en', 'English'],
              ['id', 'Bahasa Indonesia'],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={(settings.lang || 'en') === value}
                className={(settings.lang || 'en') === value ? 'active' : ''}
                onClick={() => updateSettings({ lang: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* text size + motion */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.textSize')}</b>
            <small>{t(lang, 'settings.desc.textSize')}</small>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Text size" style={{ flexWrap: 'wrap' }}>
            {[
              [0.9, 'Compact'],
              [1, 'Default'],
              [1.15, 'Large'],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={Number(settings.fontScale || 1) === value}
                className={Number(settings.fontScale || 1) === value ? 'active' : ''}
                onClick={() => updateSettings({ fontScale: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.uiScale')}</b>
            <small>{t(lang, 'settings.uiScaleDesc')}</small>
          </div>
          <div className="segmented" role="radiogroup" aria-label="UI scale" style={{ flexWrap: 'wrap' }}>
            {[
              [0.6, '60%'],
              [0.7, '70%'],
              [0.8, '80%'],
              [0.9, '90%'],
              [1, '100%'],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={Number(settings.uiScale || 1) === value}
                className={Number(settings.uiScale || 1) === value ? 'active' : ''}
                onClick={() => updateSettings({ uiScale: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.reduceMotion')}</b>
            <small>{t(lang, 'settings.desc.reduceMotion')}</small>
          </div>
          <button
            className={`switch${settings.reduceMotion ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(settings.reduceMotion)}
            aria-label="Reduce motion"
            onClick={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
          />
        </div>
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.reduceBlur')}</b>
            <small>{t(lang, 'settings.reduceBlurDesc')}</small>
          </div>
          <button
            className={`switch${settings.reduceBlur ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(settings.reduceBlur)}
            aria-label="Reduce blur"
            onClick={() => updateSettings({ reduceBlur: !settings.reduceBlur })}
          />
        </div>

        {/* home sections (custom shelves) */}
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div>
            <b>{t(lang, 'settings.homeSections')}</b>
            <small>{t(lang, 'settings.desc.homeSections')}</small>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {[
              { key: 'foryou', label: 'For You' },
              { key: 'shortcuts', label: 'Shortcuts' },
              { key: 'jump', label: 'Jump back in' },
              { key: 'recent', label: 'Recently added' },
              { key: 'playlists', label: 'Community playlists' },
              { key: 'quickpicks', label: 'Quick picks' },
              { key: 'feeds', label: 'Home feeds & charts' },
            ].map((sec) => {
              const rawOrder = settings.homeSections?.order || [];
              const order = [
                ...['foryou', 'shortcuts', 'jump', 'recent', 'playlists', 'quickpicks', 'feeds'].filter((k) => rawOrder.includes(k)),
                ...['foryou', 'shortcuts', 'jump', 'recent', 'playlists', 'quickpicks', 'feeds'].filter((k) => !rawOrder.includes(k)),
              ];
              const idx = order.indexOf(sec.key);
              const hidden = (settings.homeSections?.hidden || []).includes(sec.key);
              const canUp = idx > 0;
              const canDown = idx >= 0 && idx < order.length - 1;
              const move = (delta) => {
                const next = [...order];
                const j = Math.max(0, Math.min(next.length - 1, idx + delta));
                [next[idx], next[j]] = [next[j], next[idx]];
                updateSettings({ homeSections: { ...settings.homeSections, order: next } });
              };
              return (
                <div key={sec.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--stroke)', borderRadius: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, opacity: hidden ? 0.5 : 1 }}>{sec.label}</span>
                  <button className="icon-btn" onClick={() => move(-1)} disabled={!canUp} aria-label={`Move ${sec.label} up`} title="Move up">↑</button>
                  <button className="icon-btn" onClick={() => move(1)} disabled={!canDown} aria-label={`Move ${sec.label} down`} title="Move down">↓</button>
                  <button
                    className={`switch${hidden ? '' : ' on'}`}
                    role="switch"
                    aria-checked={!hidden}
                    aria-label={`Show ${sec.label}`}
                    onClick={() => {
                      const nextHidden = hidden
                        ? (settings.homeSections?.hidden || []).filter((k) => k !== sec.key)
                        : [...(settings.homeSections?.hidden || []), sec.key];
                      updateSettings({ homeSections: { ...settings.homeSections, hidden: nextHidden } });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* playback engine */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.playbackEngine')}</b>
            <small>{t(lang, 'settings.desc.playback')}</small>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Playback engine" style={{ flexWrap: 'wrap' }}>
            {[
              ['auto', 'Auto'],
              ['stream', 'Stream'],
              ['embed', 'Embedded'],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={(settings.engine || 'auto') === value}
                className={(settings.engine || 'auto') === value ? 'active' : ''}
                onClick={() => updateSettings({ engine: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* region */}
        <div className="setting-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <b><MapPin size={14} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--accent)' }} />Region</b>
            <small>{t(lang, 'settings.desc.region')}</small>
          </div>
          <SettingsDropdown value={settings.region || 'auto'} onChange={(v) => updateSettings({ region: v })} label="Region for charts" />
        </div>
        {(settings.region || 'auto') === 'auto' && (
          <div className="setting-hint" style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '6px 12px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{REGION_FLAGS[resolveRegion('auto').gl] || '🌐'}</span>
            <span>Detected: <b style={{ color: 'var(--text-2)' }}>{resolveRegion('auto').label} ({resolveRegion('auto').gl})</b></span>
          </div>
        )}

        {/* lossless addons (multi + failover) */}
        <div className="setting-row" style={{ alignItems: 'flex-start' }}>
          <div>
            <b><Flame size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t(lang, 'settings.lossless')}</b>
            <small>{t(lang, 'settings.desc.addons')}</small>
          </div>
        </div>
        <div style={{ padding: '4px 4px 14px' }}>
          {addons.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>{t(lang, 'settings.noAddons')}</div>
          )}
          {addons.map((a, i) => (
            <div key={`${a.manifest?.base || a.url}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--stroke)', borderRadius: 12, marginBottom: 8, background: a.enabled ? 'var(--hover)' : 'transparent' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', minWidth: 14 }}>#{i + 1}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.manifest?.name || a.url}</b>
                <small style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.manifest?.version ? `v${a.manifest.version} · ` : ''}{a.manifest?.defaultQuality || ''}</small>
              </div>
              <button className="icon-btn" onClick={() => moveAddon(i, -1)} disabled={i === 0} title={t(lang, 'settings.moveUp')} aria-label={t(lang, 'settings.moveUp')}>↑</button>
              <button className="icon-btn" onClick={() => moveAddon(i, 1)} disabled={i === addons.length - 1} title={t(lang, 'settings.moveDown')} aria-label={t(lang, 'settings.moveDown')}>↓</button>
              <button className={`switch${a.enabled ? ' on' : ''}`} role="switch" aria-checked={Boolean(a.enabled)} aria-label={`Enable ${a.manifest?.name}`} onClick={() => toggleAddon(i)} />
              <button className="icon-btn" onClick={() => removeAddon(i)} title={t(lang, 'btn.remove')} aria-label={t(lang, 'btn.remove')}><Trash2 size={16} /></button>
            </div>
          ))}
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8, marginTop: 6 }}>{t(lang, 'settings.addPreset')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <button className="pill" onClick={() => { setAddonUrl('https://deezer.nom.deno.net/manifest.json'); setAddonStatus(null); }} title={t(lang, 'settings.deezerTitle')}>Deezer</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 10 }}>
            {t(lang, 'settings.deezerHelp')}
          </div>
          <div className="sb-url-row">
            <input
              className="field"
              type="text"
              value={addonUrl}
              onChange={(e) => { setAddonUrl(e.target.value); setAddonStatus(null); }}
              placeholder="https://your-addon.example.com/manifest.json"
              aria-label="Addon manifest URL"
              autoComplete="off"
              spellCheck="false"
            />
            <button className="btn primary" onClick={runAddonTest} disabled={addonTesting || !addonUrl.trim()} style={{ gap: 8 }}>
              {addonTesting ? <Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} /> : <Plug size={15} />}
              {addonTesting ? t(lang, 'settings.testing') : t(lang, 'settings.add')}
            </button>
          </div>
          {addonStatus?.ok && (
            <div className="addon-status ok"><Check size={14} /><span>{t(lang, 'settings.addonAdded').replace('{name}', addonStatus.manifest?.name).replace('{q}', addonStatus.manifest?.defaultQuality)}</span></div>
          )}
          {addonStatus && !addonStatus.ok && <div className="addon-status err">{addonStatus.error}</div>}
        </div>

        {/* sponsorblock */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.sb')}</b>
            <small>{t(lang, 'settings.desc.sb')}</small>
          </div>
          <button
            className={`switch${settings.sb?.enabled !== false ? ' on' : ''}`}
            role="switch"
            aria-checked={settings.sb?.enabled !== false}
            aria-label="Skip sponsor segments"
            onClick={() => updateSettings({ sb: { ...(settings.sb || {}), enabled: !(settings.sb?.enabled !== false), categories: settings.sb?.categories || {} } })}
          />
        </div>
        <div style={{ padding: '4px 4px 14px', display: settings.sb?.enabled === false ? 'none' : 'block' }}>
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8 }}>{t(lang, 'settings.section.skip')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              'sponsor', 'selfpromo', 'interaction', 'music_offtopic',
              'intro', 'outro', 'filler', 'preview',
            ].map((key) => {
              const on = settings.sb?.categories?.[key] ?? { sponsor: true, selfpromo: true, interaction: true, music_offtopic: true }[key] ?? false;
              return (
                <button
                  key={key}
                  className={`pill${on ? ' active' : ''}`}
                  aria-pressed={on}
                  onClick={() => updateSettings({
                    sb: {
                      ...(settings.sb || {}),
                      enabled: true,
                      categories: { ...(settings.sb?.categories || {}), [key]: !on },
                    },
                  })}
                >
                  {t(lang, `sb.cat.${key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* youtube client */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.streamClient')}</b>
            <small>{t(lang, 'settings.desc.streamClient')}</small>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Stream source" style={{ flexWrap: 'wrap' }}>
            {[
              ['auto', 'Auto'],
              ['tv_embedded', 'TV'],
              ['web_safari', 'Safari'],
              ['ios', 'iOS'],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={(settings.ytClient || 'auto') === value}
                className={(settings.ytClient || 'auto') === value ? 'active' : ''}
                onClick={() => updateSettings({ ytClient: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* adaptive accent */}
        <div className="setting-row">
          <div>
            <b><Palette size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t(lang, 'settings.adaptiveTheme')}</b>
            <small>{t(lang, 'settings.desc.adaptive')}</small>
          </div>
          <button
            className={`switch${settings.adaptive ? ' on' : ''}`}
            role="switch"
            aria-checked={settings.adaptive}
            aria-label="Adaptive theme"
            onClick={() => updateSettings({ adaptive: !settings.adaptive })}
          />
        </div>

        {/* history */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.history')}</b>
            <small>{historyCount === 1 ? t(lang, 'settings.historyEntry') : t(lang, 'settings.historyEntries').replace('{n}', historyCount)}</small>
          </div>
          <button className="btn danger" onClick={clearHistory}><Trash2 size={15} /> {t(lang, 'btn.clear')}</button>
        </div>

        {/* export / import */}
        <div className="setting-row" style={{ alignItems: 'center' }}>
          <div>
            <b>{t(lang, 'settings.backup')}</b>
            <small>{t(lang, 'settings.desc.export')}</small>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn" onClick={exportLibrary} style={{ padding: '8px 14px', fontSize: 12.5 }}>
              <Download size={14} style={{ verticalAlign: '-1px', marginRight: 6 }} /> {t(lang, 'btn.export')}
            </button>
            <button className="btn" onClick={() => { importRef.current?.click(); }} style={{ padding: '8px 14px', fontSize: 12.5 }}>
              <Upload size={14} style={{ verticalAlign: '-1px', marginRight: 6 }} /> {t(lang, 'btn.import')}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importLibrary(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* equalizer */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.equalizer')}</b>
            <small>{t(lang, 'settings.desc.eq')}</small>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'flat', label: t(lang, 'settings.eqFlat') },
              { id: 'bass', label: t(lang, 'settings.eqBass') },
              { id: 'vocal', label: t(lang, 'settings.eqVocal') },
              { id: 'classical', label: t(lang, 'settings.eqClassical') },
            ].map((p) => (
              <button
                key={p.id}
                className={`pill${equalizerPreset === p.id ? ' active' : ''}`}
                onClick={() => setEqualizerPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
            <button className="pill" style={{ marginLeft: 'auto' }} onClick={() => setEqualizerPreset('custom')}>
              {t(lang, 'settings.custom')}
            </button>
          </div>
        </div>
        <div style={{ padding: '4px 4px 14px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {['bass', 'mid', 'treble'].map((band) => (
            <div key={band} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 70 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-3)' }}>{band[0].toUpperCase()}</label>
              <input
                type="range"
                min="-12"
                max="12"
                value={equalizerBands[band]}
                onChange={(e) => setEqualizerBand(band, Number(e.target.value))}
                style={{ width: 120, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{equalizerBands[band]} dB</span>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 'auto' }}>
            <button
              className="pill"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportEQPreset());
                  toast('EQ copied', 'Paste it in any Chordless Settings → EQ → Paste.');
                } catch { toast('Copy failed', 'Clipboard unavailable in this browser.'); }
              }}
              title={t(lang, 'settings.eqCopyTitle')}
            >
              <Copy size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> {t(lang, 'settings.copyEq')}
            </button>
            <button
              className="pill"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) importEQPreset(text);
                  else toast('Nothing to paste', 'Clipboard is empty.');
                } catch { toast('Paste unavailable', 'Allow clipboard access or check browser permissions.'); }
              }}
              title={t(lang, 'settings.eqPasteTitle')}
            >
              <Upload size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> {t(lang, 'settings.pasteEq')}
            </button>
          </div>
        </div>

        {/* crossfade */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.crossfade')}</b>
            <small>{t(lang, 'settings.desc.crossfade')}</small>
          </div>
          <button
            className={`switch${crossfade.enabled ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(crossfade.enabled)}
            aria-label="Enable crossfade"
            onClick={() => setCrossfade({ enabled: !crossfade.enabled })}
          />
        </div>
        <div style={{ padding: '4px 4px 14px', display: crossfade.enabled ? 'block' : 'none' }}>
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8 }}>{t(lang, 'settings.fadeDuration')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[3, 5, 8, 12].map((d) => (
              <button
                key={d}
                className={`pill${Number(crossfade.duration) === d ? ' active' : ''}`}
                aria-pressed={Number(crossfade.duration) === d}
                onClick={() => setCrossfade({ duration: d })}
              >
                {t(lang, 'settings.sec').replace('{d}', d)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
            {t(lang, 'settings.crossfadeTip')}
          </div>
        </div>

        {/* gapless + preload */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.gapless')}</b>
            <small>{t(lang, 'settings.desc.gapless')}</small>
          </div>
          <button
            className={`switch${gapless.enabled ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(gapless.enabled)}
            aria-label="Enable gapless playback"
            onClick={() => setGapless({ enabled: !gapless.enabled })}
          />
        </div>
        <div style={{ padding: '4px 4px 14px', display: gapless.enabled ? 'block' : 'none' }}>
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8 }}>{t(lang, 'settings.preloadAhead')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[10, 20, 30].map((d) => (
              <button
                key={d}
                className={`pill${Number(gapless.preloadSeconds) === d ? ' active' : ''}`}
                aria-pressed={Number(gapless.preloadSeconds) === d}
                onClick={() => setGapless({ preloadSeconds: d })}
              >
                {t(lang, 'settings.sec').replace('{d}', d)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
            {gaplessStatus === 'preloading' ? t(lang, 'settings.preloading') : gaplessStatus === 'ready' ? t(lang, 'settings.ready') : t(lang, 'settings.preloadDesc')}
          </div>
        </div>

        {/* spatial audio */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.spatial')}</b>
            <small>{t(lang, 'settings.desc.spatial')}</small>
          </div>
          <button
            className={`switch${spatial.enabled ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(spatial.enabled)}
            aria-label="Enable spatial audio"
            onClick={() => setSpatial({ enabled: !spatial.enabled })}
          />
        </div>
        <div style={{ padding: '4px 4px 14px', display: spatial.enabled ? 'block' : 'none' }}>
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8 }}>{t(lang, 'settings.stereoWidth')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[{ v: 1.2, l: t(lang, 'settings.widthNarrow') + ' 1.2×' }, { v: 1.6, l: t(lang, 'settings.widthWide') + ' 1.6×' }, { v: 2.0, l: t(lang, 'settings.widthWider') + ' 2.0×' }, { v: 2.4, l: t(lang, 'settings.widthMax') + ' 2.4×' }].map((o) => (
              <button
                key={o.v}
                className={`pill${Number(spatial.width) === o.v ? ' active' : ''}`}
                aria-pressed={Number(spatial.width) === o.v}
                onClick={() => setSpatial({ width: o.v })}
              >
                {o.l}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
            {t(lang, 'settings.spatialTip')}
          </div>
        </div>

        {/* autoplay / radio */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.autoplay')}</b>
            <small>{t(lang, 'settings.desc.autoplay')}</small>
          </div>
          <button
            className={`switch${settings.autoplay ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(settings.autoplay)}
            aria-label="Enable autoplay"
            onClick={() => updateSettings({ autoplay: !settings.autoplay })}
          />
        </div>
        {settings.autoplay && (
          <div style={{ padding: '0 4px 14px' }}>
            <button className="btn" onClick={() => generateRadio()} style={{ padding: '8px 14px', fontSize: 12.5 }}>
              {t(lang, 'settings.startRadio')}
            </button>
          </div>
        )}

        {/* audio advanced */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.advanced')}</b>
            <small>{t(lang, 'settings.desc.advanced')}</small>
          </div>
        </div>
        <div style={{ padding: '4px 4px 14px' }}>
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8 }}>{t(lang, 'settings.streamQuality')}</div>
          <div className="segmented" role="radiogroup" aria-label={t(lang, 'settings.streamQuality')} style={{ flexWrap: 'wrap' }}>
            {[
              ['high', t(lang, 'settings.qHigh')],
              ['medium', t(lang, 'settings.qMedium')],
              ['low', t(lang, 'settings.qLow')],
            ].map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={(settings.ytQuality || 'high') === value}
                className={(settings.ytQuality || 'high') === value ? 'active' : ''}
                onClick={() => setYtQuality(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
            {t(lang, 'settings.streamQualityDesc')}
          </div>
        </div>
        <div className="setting-row">
          <div>
            <b><Flame size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t(lang, 'settings.adaptiveQuality')}</b>
            <small>{t(lang, 'settings.desc.adaptiveQuality')}</small>
          </div>
          <button
            className={`switch${settings.adaptiveQuality !== false ? ' on' : ''}`}
            role="switch"
            aria-checked={settings.adaptiveQuality !== false}
            aria-label="Network-adaptive quality"
            onClick={() => setAdaptiveQuality(!(settings.adaptiveQuality !== false))}
          />
        </div>
        {settings.adaptiveQuality !== false && (
          <div style={{ padding: '4px 4px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
              <span className="pill active" style={{ cursor: 'default' }}>
                Auto · {effectiveYtQuality || 'high'}
              </span>
              <span style={{ color: 'var(--text-2)' }}>
                {networkInfo?.effectiveType ? `${networkInfo.effectiveType}${networkInfo.downlink ? ` · ${networkInfo.downlink} Mbps` : ''}` : t(lang, 'settings.checking')}
                {networkInfo?.rtt ? ` · ${networkInfo.rtt} ms` : ''}
              </span>
              {stallCount > 0 && <span className="pill" style={{ cursor: 'default' }}>{t(lang, 'settings.stalls').replace('{n}', stallCount)}</span>}
              <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => refreshNetworkInfo('manual')}>
                <RotateCcw size={13} /> {t(lang, 'settings.checkNow')}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
              {networkInfo?.reason === 'auto' ? t(lang, 'settings.netFast') : t(lang, 'settings.netReason').replace('{r}', networkInfo?.reason || '—')}
            </div>
          </div>
        )}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.normalize')}</b>
            <small>{t(lang, 'settings.desc.normalize')}</small>
          </div>
          <button
            className={`switch${settings.normalize ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(settings.normalize)}
            aria-label="Normalize loudness"
            onClick={() => setNormalize(!settings.normalize)}
          />
        </div>
        <div style={{ padding: '4px 4px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', minWidth: 42 }}>{t(lang, 'settings.balance')}</span>
          <input
            type="range"
            min="-50"
            max="50"
            value={Math.round((Number(settings.balance) || 0) * 50)}
            onChange={(e) => setBalance(Number(e.target.value) / 50)}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
            aria-label="Stereo balance"
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-2)', minWidth: 64, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {Number(settings.balance) === 0 ? t(lang, 'settings.center') : Number(settings.balance) < 0 ? `L ${Math.round(-Number(settings.balance) * 50)}` : `R ${Math.round(Number(settings.balance) * 50)}`}
          </span>
        </div>
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.skipSilence')}</b>
            <small>{t(lang, 'settings.desc.skipSilence')}</small>
          </div>
          <button
            className={`switch${settings.skipSilence ? ' on' : ''}`}
            role="switch"
            aria-checked={Boolean(settings.skipSilence)}
            aria-label="Skip silence"
            onClick={() => updateSettings({ skipSilence: !settings.skipSilence })}
          />
        </div>

        {/* keyboard remap */}
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div>
            <b>{t(lang, 'settings.keybinds')}</b>
            <small>{t(lang, 'settings.desc.keybinds')}</small>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {[['playPause', t(lang, 'kbd.playPause')], ['next', t(lang, 'player.next')], ['prev', t(lang, 'player.prev')]].map(([id, label]) => {
              const keys = (settings.keybinds?.[id] || []).join(' + ') || '—';
              return (
                <button
                  key={id}
                  className={`pill${remapFor === id ? ' active' : ''}`}
                  onClick={() => setRemapFor(remapFor === id ? null : id)}
                  title={t(lang, 'settings.remap').replace('{label}', label)}
                >
                  {label}: <b>{keys}</b>
                </button>
              );
            })}
            {remapFor && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{t(lang, 'settings.pressKey')}</span>}
          </div>
        </div>

        {/* reset */}
        <div className="setting-row">
          <div>
            <b>{t(lang, 'settings.reset')}</b>
            <small>{t(lang, 'settings.desc.reset')}</small>
          </div>
          <button
            className={`btn danger${resetArm ? ' armed' : ''}`}
            onClick={() => (resetArm ? resetAll() : setResetArm(true))}
            onBlur={() => setResetArm(false)}
          >
            <Trash2 size={15} /> {resetArm ? t(lang, 'settings.resetQ') : t(lang, 'settings.resetNow')}
          </button>
        </div>

        {/* shortcuts */}
        <div style={{ marginTop: 18 }}>
          <div className="section-label" style={{ paddingLeft: 4 }}>
            <Keyboard size={13} style={{ verticalAlign: '-1px', marginRight: 6 }} />{t(lang, 'settings.kbdTitle')}
          </div>
          <div className="sc-grid">
            {shortcuts.map(([keys, actionKey]) => (
              <div key={keys} style={{ display: 'contents' }}>
                <span className="kbd">{keys}</span>
                <span>{t(lang, actionKey)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* about */}
        <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--hover)', borderRadius: 14, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} /> About Chordless
          </b>
          A free, ad-free music client for the browser — audio only, never video. Streams via your local backend; lyrics from <a href="https://lrclib.net" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>LRCLIB <ExternalLink size={10} style={{ verticalAlign: '-1px' }} /></a>. Not affiliated with Google or any streaming provider. Made with <Heart size={11} style={{ fill: 'var(--accent)', stroke: 'none', verticalAlign: '-1px' }} /> for personal use.
        </div>
      </div>
    </div>
  );
}
