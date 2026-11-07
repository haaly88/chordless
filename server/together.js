/**
 * Listen Together — in-memory room state (no auth, code-based).
 * Host is the source of truth for playback. Guests poll state and follow.
 * Rooms expire after 2h idle. Single-process only (no Redis).
 */

const rooms = new Map(); // code -> room
const TTL_MS = 2 * 60 * 60 * 1000;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function now() { return Date.now(); }

function prune() {
  const t = now();
  for (const [code, r] of rooms) {
    if (t - (r.lastSeen || r.createdAt) > TTL_MS) rooms.delete(code);
  }
}

setInterval(prune, 5 * 60 * 1000).unref?.();

function publicRoom(room) {
  return {
    code: room.code,
    members: [...room.members.values()].map((m) => ({ id: m.id, name: m.name, joinedAt: m.joinedAt, isHost: m.id === room.hostId })),
    hostId: room.hostId,
    createdAt: room.createdAt,
    state: room.state,
    messages: (room.messages || []).slice(-50),
  };
}

export function createRoom(name) {
  prune();
  let code = genCode();
  let guard = 0;
  while (rooms.has(code) && guard++ < 20) code = genCode();
  const memberId = uid();
  const cleanName = String(name || 'Guest').trim().slice(0, 40) || 'Guest';
  const room = {
    code,
    hostId: memberId,
    members: new Map([[memberId, { id: memberId, name: cleanName, joinedAt: now() }]]),
    state: { track: null, queue: [], index: -1, isPlaying: false, currentTime: 0, updatedAt: now(), version: 0 },
    messages: [],
    createdAt: now(),
    lastSeen: now(),
  };
  rooms.set(code, room);
  return { code, memberId, host: true, room: publicRoom(room) };
}

export function joinRoom(code, name) {
  prune();
  const r = rooms.get(String(code || '').trim().toUpperCase());
  if (!r) return null;
  if (r.members.size >= 12) return { error: 'Room is full (max 12).' };
  const memberId = uid();
  const cleanName = String(name || 'Guest').trim().slice(0, 40) || 'Guest';
  r.members.set(memberId, { id: memberId, name: cleanName, joinedAt: now() });
  r.lastSeen = now();
  return { code: r.code, memberId, host: false, room: publicRoom(r) };
}

export function getRoom(code, memberId) {
  const r = rooms.get(String(code || '').trim().toUpperCase());
  if (!r) return null;
  if (memberId && !r.members.has(memberId)) return null;
  r.lastSeen = now();
  return publicRoom(r);
}

export function pushState(code, memberId, patch) {
  const r = rooms.get(String(code || '').trim().toUpperCase());
  if (!r) return null;
  if (!r.members.has(memberId)) return null;
  // Only host can push authoritative state; guests may send lightweight pings (ignored).
  if (memberId !== r.hostId) return publicRoom(r);
  const allowed = ['track', 'queue', 'index', 'isPlaying', 'currentTime'];
  for (const k of allowed) {
    if (k in (patch || {})) r.state[k] = patch[k];
  }
  r.state.updatedAt = now();
  r.state.version += 1;
  r.lastSeen = now();
  return publicRoom(r);
}

export function pushChat(code, memberId, text) {
  const r = rooms.get(String(code || '').trim().toUpperCase());
  if (!r) return null;
  const member = r.members.get(memberId);
  if (!member) return null;
  const msg = String(text || '').trim().slice(0, 200);
  if (!msg) return publicRoom(r);
  r.messages.push({ id: uid(), memberId, name: member.name, text: msg, at: now() });
  if (r.messages.length > 50) r.messages = r.messages.slice(-50);
  r.lastSeen = now();
  return publicRoom(r);
}

export function leaveRoom(code, memberId) {  const r = rooms.get(String(code || '').trim().toUpperCase());
  if (!r) return { left: true };
  r.members.delete(memberId);
  if (memberId === r.hostId) {
    const next = [...r.members.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!next) {
      rooms.delete(r.code);
      return { left: true, closed: true };
    }
    r.hostId = next.id;
  }
  r.lastSeen = now();
  return { left: true, room: publicRoom(r) };
}
