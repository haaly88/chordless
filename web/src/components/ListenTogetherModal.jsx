import { useState } from 'react';
import { X, Users, Copy, Check, LogOut, RefreshCw } from 'lucide-react';
import usePlayer from '../store.js';

/**
 * Listen Together — create/join a room, see members, leave.
 * Playback sync itself lives in the store (host-authoritative polling).
 */
export default function ListenTogetherModal() {
  const together = usePlayer((s) => s.together);
  const toggleTogether = usePlayer((s) => s.toggleTogether);
  const createTogetherRoom = usePlayer((s) => s.createTogetherRoom);
  const joinTogetherRoom = usePlayer((s) => s.joinTogetherRoom);
  const leaveTogetherRoom = usePlayer((s) => s.leaveTogetherRoom);
  const _togetherPollOnce = usePlayer((s) => s._togetherPollOnce);

  const [name, setName] = useState(() => {
    try { return localStorage.getItem('cl:togetherName') || ''; } catch { return ''; }
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveName = (v) => {
    setName(v);
    try { localStorage.setItem('cl:togetherName', v); } catch { /* ignore */ }
  };

  const onCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await createTogetherRoom(name); } finally { setBusy(false); }
  };
  const onJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    setBusy(true);
    try { await joinTogetherRoom(code, name); } finally { setBusy(false); }
  };

  const copyCode = async () => {
    if (!together?.code) return;
    try {
      await navigator.clipboard.writeText(together.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  const inRoom = Boolean(together?.code);

  return (
    <div className="modal-backdrop" onClick={() => toggleTogether(false)} role="presentation" style={{ zIndex: 95 }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Listen Together" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={20} style={{ color: 'var(--accent)' }} /> Listen Together</h2>
          <button className="icon-btn" onClick={() => toggleTogether(false)} aria-label="Close"><X size={20} /></button>
        </div>

        {!inRoom ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 14px' }}>
              Listen to the same song at the same time as friends. The host controls playback — everyone follows. Works while you’re on the same Chordless server.
            </p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 6 }}>YOUR NAME</label>
            <input className="field" value={name} onChange={(e) => saveName(e.target.value)} placeholder="e.g. Rina" aria-label="Your name" maxLength={40} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={onCreate} disabled={!name.trim() || busy} style={{ flex: 1 }}>
                {busy ? 'Working…' : 'Create room'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 12px' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--stroke-strong)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>OR JOIN</span>
              <span style={{ flex: 1, height: 1, background: 'var(--stroke-strong)' }} />
            </div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: 6 }}>ROOM CODE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="field"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                placeholder="ABCDE"
                aria-label="Room code"
                maxLength={5}
                style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '.2em', textAlign: 'center', fontWeight: 800 }}
              />
              <button className="btn" onClick={onJoin} disabled={!name.trim() || code.trim().length < 5 || busy}>
                Join
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 12 }}>Max 12 people per room. Rooms close when the host leaves.</p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '1px solid var(--stroke)', borderRadius: 14, background: 'var(--hover)', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 800, letterSpacing: '.1em' }}>ROOM CODE</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '.3em' }}>{together.code}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                  {together.isHost ? 'You are the host — you control playback.' : 'Following the host.'} · Synced {new Date(together.lastSyncAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
              <button className="btn" onClick={copyCode} aria-label="Copy room code">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8 }}>IN THE ROOM ({(together.members || []).length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
              {(together.members || []).map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--stroke)', borderRadius: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--hover-strong)', fontWeight: 800, fontSize: 13 }}>
                    {String(m.name || '?')[0].toUpperCase()}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5 }}>{m.name}{m.id === together.memberId ? ' (you)' : ''}</span>
                  {m.isHost && <span className="pill active" style={{ cursor: 'default', fontSize: 10.5 }}>HOST</span>}
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => _togetherPollOnce?.()} aria-label="Sync now">
                <RefreshCw size={14} /> Sync now
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => toggleTogether(false)}>Close</button>
                <button className="btn danger" onClick={leaveTogetherRoom}>
                  <LogOut size={14} /> Leave
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
