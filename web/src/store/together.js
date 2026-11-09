/**
 * Chordless — store slice: Listen Together (host-authoritative sync rooms).
 * State fields (`together`, `togetherApplyingRemote`) stay in `store.js`;
 * this slice provides the behaviour helpers sharing the same `set`/`get`.
 */
import { apiTogetherCreate, apiTogetherJoin, apiTogetherState, apiTogetherPush, apiTogetherChat, apiTogetherPresence, apiTogetherLeave } from '../lib/api.js';

export function createTogetherSlice(set, get, deps) {
  const {
    activeAudio = () => null,
    loadAndPlay = () => {},
    write = () => {},
    toast = () => {},
  } = deps;

  return {
    async createTogetherRoom(name) {
      const clean = String(name || 'Host').trim().slice(0, 40) || 'Host';
      try {
        const res = await apiTogetherCreate(clean);
        set({ together: { code: res.code, memberId: res.memberId, name: clean, isHost: true, members: res.room?.members || [], messages: res.room?.messages || [], remoteVersion: res.room?.state?.version || 0, lastSyncAt: Date.now() } });
        toast('Room created', `Share code ${res.code} — others join with the same code.`);
        get()._togetherPushState();
        return res;
      } catch (e) {
        toast('Could not create room', e.message || 'Check the backend connection.');
        return null;
      }
    },
    async joinTogetherRoom(code, name) {
      const cleanName = String(name || 'Guest').trim().slice(0, 40) || 'Guest';
      const cleanCode = String(code || '').trim().toUpperCase();
      if (!cleanCode) { toast('Missing code', 'Enter the 5-letter room code.'); return null; }
      try {
        const res = await apiTogetherJoin(cleanCode, cleanName);
        set({ together: { code: res.code, memberId: res.memberId, name: cleanName, isHost: false, members: res.room?.members || [], messages: res.room?.messages || [], remoteVersion: res.room?.state?.version || 0, lastSyncAt: Date.now() } });
        toast('Joined room', `Room ${res.code} — following the host.`);
        get()._togetherPollOnce();
        return res;
      } catch (e) {
        toast('Could not join room', e.message || 'Check the code and try again.');
        return null;
      }
    },
    async leaveTogetherRoom() {
      const { together } = get();
      if (!together?.code) return;
      try { await apiTogetherPresence(together.code, together.memberId, null); } catch { /* best-effort */ }
      try { await apiTogetherLeave(together.code, together.memberId); } catch { /* best-effort */ }
      set({ together: { code: null, memberId: null, name: '', isHost: false, members: [], messages: [], remoteVersion: 0, lastSyncAt: 0 } });
      toast('Left room', 'Back to solo listening.');
    },
    async sendTogetherChat(text) {
      const msg = String(text || '').trim().slice(0, 200);
      const { together } = get();
      if (!together?.code || !msg) return;
      try {
        const room = await apiTogetherChat(together.code, together.memberId, msg);
        if (room?.messages) set((prev) => ({ together: { ...prev.together, messages: room.messages } }));
      } catch { /* poll will retry on next heartbeat */ }
    },
    _togetherPushPresence() {
      const { together } = get();
      if (!together?.code) return;
      const track = get().currentTrack();
      apiTogetherPresence(together.code, together.memberId, track || null)
        .then((room) => {
          if (room?.members) set((prev) => ({ together: { ...prev.together, members: room.members } }));
        })
        .catch(() => {});
    },
    _togetherPushState() {
      const { together } = get();
      if (!together?.code || !together?.isHost) return;
      const s = get();
      const state = {
        track: s.currentTrack() || null,
        queue: s.queue || [],
        index: s.index,
        isPlaying: s.isPlaying,
        currentTime: s.currentTime || 0,
      };
      apiTogetherPush(together.code, together.memberId, state)
        .then((room) => {
          if (room?.members) set((prev) => ({ together: { ...prev.together, members: room.members, remoteVersion: room.state?.version ?? prev.together.remoteVersion, lastSyncAt: Date.now() } }));
        })
        .catch(() => { /* host push is best-effort; next heartbeat retries */ });
    },
    async _togetherPollOnce() {
      const { together } = get();
      if (!together?.code) return;
      try {
        const room = await apiTogetherState(together.code, together.memberId);
        const remote = room.state || {};
        const version = remote.version || 0;
        const wasHost = together.isHost;
        const isHostNow = room.hostId === together.memberId;
        const members = room.members || [];
        const messages = room.messages || [];

        get()._togetherSyncMessages(messages, together);
        get()._togetherSyncHost(room, together, wasHost, isHostNow, members, version);
        get()._togetherCorrectDrift(remote);
      } catch (e) {
        if (String(e || '').includes('404')) {
          set({ together: { code: null, memberId: null, name: '', isHost: false, members: [], messages: [], remoteVersion: 0, lastSyncAt: 0 } });
          toast('Room closed', 'The host left — back to solo listening.');
        }
      }
    },
    _togetherSyncMessages(messages, together) {
      if (messages.length !== (together.messages || [])) {
        set((prev) => ({ together: { ...prev.together, messages } }));
      }
    },
    _togetherSyncHost(room, together, wasHost, isHostNow, members, version) {
      if (version !== together.remoteVersion || (!wasHost && isHostNow)) {
        set((prev) => ({ together: { ...prev.together, members, isHost: isHostNow, remoteVersion: version, lastSyncAt: Date.now() } }));
        if (!isHostNow && !get().togetherApplyingRemote) {
          get()._togetherApplyRemote(room);
        } else {
          set((prev) => ({ together: { ...prev.together, members, isHost: isHostNow } }));
        }
      } else if (members.length !== together.members.length) {
        set((prev) => ({ together: { ...prev.together, members, lastSyncAt: Date.now() } }));
      }
    },
    _togetherApplyRemote(room) {
      const remote = room.state || {};
      const track = remote.track;
      const queue = Array.isArray(remote.queue) ? remote.queue : [];
      const index = Number.isInteger(remote.index) ? remote.index : -1;
      const current = get().currentTrack();
      if (track && queue.length && (current?.id !== track.id || get().index !== index)) {
        set({ togetherApplyingRemote: true });
        set({ queue: queue.slice(), index, shuffleBackup: null, shuffle: false });
        loadAndPlay(index, queue.slice());
        set({ togetherApplyingRemote: false });
      } else if (track && current?.id === track.id) {
        // Same song: correct play/pause drift only.
        if (Boolean(remote.isPlaying) !== get().isPlaying) {
          set({ togetherApplyingRemote: true });
          if (remote.isPlaying) {
            const el = activeAudio();
            if (!el.src) loadAndPlay(get().index, get().queue);
            else { el.play().catch(() => {}); set({ isPlaying: true }); }
          } else {
            activeAudio().pause();
            set({ isPlaying: false });
          }
          set({ togetherApplyingRemote: false });
        }
      }
    },
    _togetherCorrectDrift(remote) {
      const { together } = get();
      if (!together?.isHost && remote.track && get().currentTrack()?.id === remote.track.id && remote.isPlaying) {
        const anchor = remote.updatedAt || Date.now();
        const hostTime = (remote.currentTime || 0) + (Date.now() - anchor) / 1000;
        const local = get().currentTime || 0;
        if (Math.abs(hostTime - local) > 1.5 && hostTime >= 0) {
          set({ togetherApplyingRemote: true });
          try { activeAudio().currentTime = hostTime; set({ currentTime: hostTime }); } catch { /* ignore */ }
          set({ togetherApplyingRemote: false });
        }
      }
    },
  };
}
