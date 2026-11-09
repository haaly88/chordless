/**
 * Chordless — global player & library store (zustand).
 * Owns the singleton <audio> element, the Web Audio analyser,
 * queue/shuffle/repeat, sleep timer, likes, playlists, history,
 * settings — all persisted to localStorage where appropriate.
 */
import { create } from 'zustand';
import { apiSponsorBlock, apiChapters, apiAddonSearch, apiTranslate, apiSearch, addonTrackUrl, apiTogetherCreate, apiTogetherJoin, apiTogetherState, apiTogetherPush, apiTogetherChat, apiTogetherPresence, apiTogetherLeave, apiShareCreate, apiShareGet } from './lib/api.js';
import { upgradeTracks } from './lib/thumb.js';
import { translateToastTitle, translateToastSub } from './lib/i18n.js';
import { totalDuration, formatTotalDuration } from './lib/format.js';
import { buildForYouMix } from './lib/ai-mix.js';
import { read, write, readString, writeString, readMigrated } from './lib/storage.js';
import { streamSrc, qualityFromConnection, connectionSnapshot, lowerQuality } from './lib/quality.js';
import { SB_LABELS, DEFAULT_SB_CATEGORIES, sbCategories } from './lib/sb.js';
import { uid, shuffled, sameTrack, smartShuffle } from './lib/shuffle.js';
import { embedBridge, isEmbedEngine } from './lib/embed.js';
import { hasOffline, listOfflineIds, getOfflineUrl, saveOffline, removeOffline, clearOffline } from './lib/offline.js';
import { createToastNavSlice } from './store/toastNav.js';

// Re-exported so existing imports from './store.js' keep working.
export { read, write, readString, writeString, readMigrated };
export { streamSrc, qualityFromConnection, connectionSnapshot };
export { SB_LABELS, DEFAULT_SB_CATEGORIES, sbCategories };
export { embedBridge, isEmbedEngine };

// ---------- singleton audio element ----------
// Gapless uses TWO elements (A = primary/active, B = preload/next).
// `audio` stays exported as slot A for backwards compat; activeAudio()
// returns whichever slot is currently audible. Both sources feed the SAME
// Web Audio chain (EQ → normalize → balance → spatial → analyser), so EQ/
// spatial/normalize/visualizer keep working after a swap.
export const audio = new Audio();
audio.preload = 'auto';
audio.crossOrigin = 'anonymous';
export const audioB = new Audio();
audioB.preload = 'auto';
audioB.crossOrigin = 'anonymous';
let activeSlot = 'A';
let silenceSince = null;
let pendingInstallPrompt = null;
export function setPendingInstallPrompt(evt) { pendingInstallPrompt = evt; }
export function getPendingInstallPrompt() { return pendingInstallPrompt; }
export function activeAudio() { return activeSlot === 'A' ? audio : audioB; }
export function inactiveAudio() { return activeSlot === 'A' ? audioB : audio; }
export function getActiveSlot() { return activeSlot; }
// Module-level gapless state (not reactive — read via store state mirrors).
let preloaded = null; // { forIndex, trackId, url, slot }
let preloadBusy = { forIndex: null }; // guards async offline-resolve spawns
let translateToken = 0; // guards lyric-translation races per track

let audioCtx = null;
let analyserNode = null;
let bassFilter = null;
let midFilter = null;
let trebleFilter = null;

// Spatial (mid/side widening) — nodes created once, gains updated live.
let spatialSideToL = null;
let spatialSideToR = null;

// Audio advanced: loudness normalizer + stereo balance.
let normalizeGain = null;
let normalizeComp = null;
let balancePanner = null;

export function applySpatial(enabled, width) {
  if (!spatialSideToL || !spatialSideToR) return;
  const w = enabled ? Math.max(1, Math.min(2.4, Number(width) || 1.6)) : 1;
  // Smooth the change to avoid clicks.
  const t = audioCtx?.currentTime || 0;
  try {
    spatialSideToL.gain.setTargetAtTime(w, t, 0.03);
    spatialSideToR.gain.setTargetAtTime(-w, t, 0.03);
  } catch { /* context closed */ }
}

export function applyNormalize(enabled) {
  if (!normalizeGain || !normalizeComp) return;
  const t = audioCtx?.currentTime || 0;
  try {
    if (enabled) {
      normalizeGain.gain.setTargetAtTime(1.5, t, 0.05);
      normalizeComp.threshold.setTargetAtTime(-20, t, 0.05);
      normalizeComp.ratio.setTargetAtTime(4, t, 0.05);
    } else {
      normalizeGain.gain.setTargetAtTime(1, t, 0.05);
      normalizeComp.threshold.setTargetAtTime(0, t, 0.05);
      normalizeComp.ratio.setTargetAtTime(1, t, 0.05);
    }
  } catch { /* context closed */ }
}

export function applyBalance(pan) {
  if (!balancePanner) return;
  const p = Math.max(-1, Math.min(1, Number(pan) || 0));
  try {
    if (balancePanner.pan) balancePanner.pan.setTargetAtTime(p, audioCtx?.currentTime || 0, 0.03);
    else balancePanner.setTargetAtTime(p, audioCtx?.currentTime || 0, 0.03);
  } catch { /* context closed */ }
}

// ---------- crossfade (single-element fade transition) ----------
// No async/await here by design — the previous implementation hit a TDZ
// error from an async pattern. All timers are plain setInterval/setTimeout
// declared at module scope so they can never be accessed before init.
let fadeTimer = null;
let fadingOut = false;
let transitionToken = 0;
let lastPreviewWarnedId = null;

function clearFadeTimer() {
  if (fadeTimer != null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function getAnalyser() {
  if (analyserNode) return analyserNode;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);
    // Second slot for gapless preload — shares the same chain so a swap
    // doesn't need a rebuild. created once; both elements then feed the EQ.
    let sourceB = null;
    try { sourceB = audioCtx.createMediaElementSource(audioB); } catch { sourceB = null; }

    // 3-band EQ: bass (lowshelf), mid (peaking), treble (highshelf)
    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 320;
    bassFilter.gain.value = 0;

    midFilter = audioCtx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;
    midFilter.gain.value = 0;

    trebleFilter = audioCtx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3200;
    trebleFilter.gain.value = 0;

    source.connect(bassFilter);
    if (sourceB) { try { sourceB.connect(bassFilter); } catch { /* already connected */ } }
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);

    // Audio advanced chain: EQ -> normalize (gain+comp) -> balance (panner) -> spatial -> analyser
    normalizeGain = audioCtx.createGain();
    normalizeGain.gain.value = 1;
    normalizeComp = audioCtx.createDynamicsCompressor();
    normalizeComp.threshold.value = 0;
    normalizeComp.knee.value = 18;
    normalizeComp.ratio.value = 1;
    normalizeComp.attack.value = 0.003;
    normalizeComp.release.value = 0.24;
    balancePanner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : audioCtx.createGain();
    if (balancePanner.pan) balancePanner.pan.value = 0;

    trebleFilter.connect(normalizeGain);
    normalizeGain.connect(normalizeComp);
    normalizeComp.connect(balancePanner);

    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.82;

    // Spatial widening (mid/side): L'/R' = mid ± side*width.
    // width=1 gives perfect stereo reconstruction; higher widens the image.
    const splitter = audioCtx.createChannelSplitter(2);
    const merger = audioCtx.createChannelMerger(2);
    const g = (v) => { const n = audioCtx.createGain(); n.gain.value = v; return n; };
    const midGainL = g(0.5), midGainR = g(0.5);
    const sideGainL = g(0.5), sideGainR = g(-0.5);
    const midSum = g(1), sideSum = g(1);
    const midToL = g(1), midToR = g(1);
    spatialSideToL = g(1); spatialSideToR = g(-1);
    balancePanner.connect(splitter);
    splitter.connect(midGainL, 0); splitter.connect(midGainR, 1);
    splitter.connect(sideGainL, 0); splitter.connect(sideGainR, 1);
    midGainL.connect(midSum); midGainR.connect(midSum);
    sideGainL.connect(sideSum); sideGainR.connect(sideSum);
    midSum.connect(midToL); midSum.connect(midToR);
    sideSum.connect(spatialSideToL); sideSum.connect(spatialSideToR);
    midToL.connect(merger, 0, 0); spatialSideToL.connect(merger, 0, 0);
    midToR.connect(merger, 0, 1); spatialSideToR.connect(merger, 0, 1);
    merger.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
    // Apply persisted spatial + audio-advanced settings immediately.
    try {
      const s = usePlayer.getState().settings;
      applySpatial(Boolean(s?.spatial?.enabled), s?.spatial?.width || 1.6);
      applyNormalize(Boolean(s?.normalize));
      applyBalance(Number(s?.balance) || 0);
    } catch { /* store not ready yet */ }
  } catch (e) {
    console.warn('[analyser] unavailable:', e);
  }
  return analyserNode;
}

const EQ_PRESETS = {
  flat: { bass: 0, mid: 0, treble: 0 },
  bass: { bass: 6, mid: 0, treble: -2 },
  vocal: { bass: -2, mid: 4, treble: 0 },
  classical: { bass: 0, mid: 2, treble: 2 },
};

export function applyEqualizer(bass, mid, treble) {
  if (!bassFilter || !midFilter || !trebleFilter) return;
  bassFilter.gain.value = Math.max(-12, Math.min(12, bass));
  midFilter.gain.value = Math.max(-12, Math.min(12, mid));
  trebleFilter.gain.value = Math.max(-12, Math.min(12, treble));
}

const storedSettings = readMigrated('cl:settings', {}) || {};

// Upgrade persisted artwork URLs to high-res (old saves may carry =w120 thumbnails)
const upgradePersisted = (list) => (Array.isArray(list) ? upgradeTracks(list) : list);
// Multi-addon: migrate legacy single addon into a list (primary = first enabled).
const migratedAddons = (() => {
  const list = Array.isArray(storedSettings?.addons)
    ? storedSettings.addons.filter((a) => a?.url && a?.manifest?.id)
    : (storedSettings?.addon?.manifest?.id ? [storedSettings.addon] : []);
  return list.map((a) => ({
    url: String(a.url || ''),
    enabled: Boolean(a.enabled),
    manifest: a.manifest || null,
  }));
})();
const primaryAddon = migratedAddons.find((a) => a.enabled) || migratedAddons[0] || { url: '', enabled: false, manifest: null };
const persistedSettings = {
  theme: 'dark',
  adaptive: true,
  ytClient: 'auto',
  engine: 'auto',
  ...storedSettings,
  addon: primaryAddon,
  addons: migratedAddons,
  sb: {
    enabled: storedSettings?.sb?.enabled !== false,
    categories: { ...DEFAULT_SB_CATEGORIES, ...(storedSettings?.sb?.categories || {}) },
  },
  crossfade: {
    enabled: Boolean(storedSettings?.crossfade?.enabled),
    duration: [3, 5, 8, 12].includes(Number(storedSettings?.crossfade?.duration))
      ? Number(storedSettings.crossfade.duration)
      : 5,
  },
  gapless: {
    enabled: storedSettings?.gapless?.enabled === true,
    preloadSeconds: [10, 20, 30].includes(Number(storedSettings?.gapless?.preloadSeconds))
      ? Number(storedSettings.gapless.preloadSeconds)
      : 20,
  },
  spatial: {
    enabled: Boolean(storedSettings?.spatial?.enabled),
    width: [1.2, 1.6, 2.0, 2.4].includes(Number(storedSettings?.spatial?.width)) ? Number(storedSettings.spatial.width) : 1.6,
  },
  ytQuality: ['high', 'medium', 'low'].includes(String(storedSettings?.ytQuality || 'high')) ? String(storedSettings.ytQuality) : 'high',
  adaptiveQuality: storedSettings?.adaptiveQuality !== false,
  normalize: Boolean(storedSettings?.normalize),
  balance: Math.max(-1, Math.min(1, Number(storedSettings?.balance) || 0)),
  region: String(storedSettings?.region || 'auto').toUpperCase() === 'AUTO' ? 'auto' : String(storedSettings?.region || 'auto').toUpperCase(),
  autoplay: Boolean(storedSettings?.autoplay),
  fontScale: [0.9, 1, 1.15].includes(Number(storedSettings?.fontScale)) ? Number(storedSettings.fontScale) : 1,
  // Whole-UI scale. Auto-compensates Windows display scaling (dpr 1.5):
  // on high-DPR displays the default shrinks the layout so it matches the
  // physical size users see in unaffected browsers. User-overridable.
  uiScale: (() => {
    const allowed = [0.6, 0.7, 0.8, 0.9, 1];
    if (allowed.includes(Number(storedSettings?.uiScale))) return Number(storedSettings.uiScale);
    const dpr = typeof window !== 'undefined' ? Number(window.devicePixelRatio || 1) : 1;
    return dpr >= 1.45 ? 0.7 : dpr >= 1.2 ? 0.8 : 1;
  })(),
  reduceMotion: storedSettings?.reduceMotion === true,
  reduceBlur: storedSettings?.reduceBlur === true,
  notifyBackground: storedSettings?.notifyBackground === true,
  notifyForeground: storedSettings?.notifyForeground === true,
  closeToTray: storedSettings?.closeToTray !== false,
  openAtLogin: storedSettings?.openAtLogin === true,
  sidebarCollapsed: storedSettings?.sidebarCollapsed === true,
  lang: ['en', 'id'].includes(String(storedSettings?.lang || 'en')) ? String(storedSettings.lang) : 'en',
  homeSections: {
    order: Array.isArray(storedSettings?.homeSections?.order)
      ? storedSettings.homeSections.order.filter((s) => typeof s === 'string')
      : ['foryou', 'shortcuts', 'jump', 'recent', 'playlists', 'quickpicks', 'feeds'],
    hidden: Array.isArray(storedSettings?.homeSections?.hidden)
      ? storedSettings.homeSections.hidden.filter((s) => typeof s === 'string')
      : [],
  },
  skipSilence: storedSettings?.skipSilence === true,
  keybinds: {
    playPause: [' ', 'k'],
    next: ['n'],
    prev: ['p'],
    ...(storedSettings?.keybinds && typeof storedSettings.keybinds === 'object' ? storedSettings.keybinds : {}),
  },
};
const persistedFolders = Array.isArray(readMigrated('cl:folders', []))
  ? readMigrated('cl:folders', []).filter((f) => f?.id && f?.name).map((f) => ({ id: String(f.id), name: String(f.name).slice(0, 60), createdAt: f.createdAt || Date.now() }))
  : [];
const persistedQueueRaw = readMigrated('cl:queue', null);
const persistedQueue = persistedQueueRaw
  ? { ...persistedQueueRaw, queue: upgradeTracks(persistedQueueRaw.queue || []) }
  : null;

export const usePlayer = create((set, get) => ({
  // ---- playback state ----
  queue: persistedQueue?.queue?.length ? persistedQueue.queue : [],
  // Clamp a stale/corrupt persisted index into range.
  index: (persistedQueue?.queue?.length && Number.isInteger(persistedQueue?.index))
    ? Math.max(0, Math.min(persistedQueue.index, persistedQueue.queue.length - 1))
    : -1,
  restorePosition: persistedQueue?.position || 0,
  hasRestoredQueue: Boolean(persistedQueue?.queue?.length),
  isPlaying: false,
  isReady: false,          // audio element loaded metadata for current src
  trackLoading: false,
  streamError: null,
  currentTime: 0,
  duration: 0,
  volume: readMigrated('cl:volume', 0.8) ?? 0.8,
  muted: false,
  shuffle: false,
  repeat: 'off',           // off | all | one
  playbackRate: 1,
  sleepTimer: null,        // null | 'track' | epoch ms
  abLoop: { a: null, b: null }, // AB loop points in seconds (current track only)
  shuffleBackup: null,
  streamFellBack: false,   // stream blocked → play via embedded player
  segments: [],            // SponsorBlock skip segments for the current track
  segmentsFor: null,       // video id the segments belong to (null while loading)
  ignoreSegmentUuid: null, // segment NOT to re-skip (set after Undo)
  chapters: [],            // YouTube chapters for the current track
  chaptersFor: null,
  installAvailable: false, // PWA beforeinstallprompt fired
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,

  // ---------- equalizer ----------
  equalizerPreset: 'flat',
  equalizerBands: { bass: 0, mid: 0, treble: 0 },

  // ---------- lyrics translation ----------
  lyricsTranslation: false,
  lyricsTargetLang: 'id',
  translatedLyrics: null,   // { translated, target } cached per track

  // ---- ui state ----
  view: { name: 'home' },
  nowPlayingOpen: false,
  queueOpen: false,
  lyricsOpen: false,
  karaokeOpen: false,
  karaokeFontSize: 'large',
  lyricsOffset: 0,
  settingsOpen: false,
  togetherOpen: false,
  shortcutsOpen: false,
  menu: null,              // { x, y, track, contextList, playlistId }
  searchQuery: '',
  searchFocusTick: 0,      // increment to focus search input
  miniPlayer: false,       // collapsed PlayerBar (mini mode)

  // ---- search history (strings only — protects against corrupted storage) ----
  searchHistory: (Array.isArray(readMigrated('cl:searchHistory', [])) ? readMigrated('cl:searchHistory', []).filter((h) => typeof h === 'string') : []),
  savedSearches: (Array.isArray(readMigrated('cl:savedSearches', []))
    ? readMigrated('cl:savedSearches', []).filter((s) => s && typeof s.query === 'string' && typeof s.id === 'string')
    : []),

  // ---- library ----
  liked: upgradePersisted(readMigrated('cl:liked', [])) || [],
  playlists: (readMigrated('cl:playlists', []) || []).map((p) => ({ ...p, folderId: p.folderId || null, tracks: upgradeTracks(p.tracks || []) })),
  folders: persistedFolders,
  history: upgradePersisted(readMigrated('cl:history', [])) || [],
  settings: persistedSettings,
  accent: null,            // { accent, accentSoft } extracted from artwork (adaptive)
  toasts: [],

  // ---- For You AI Mix ----
  forYou: (() => {
    try {
      const raw = readMigrated('cl:forYou', null);
      if (raw && Array.isArray(raw.tracks) && raw.tracks.length) return { ...raw, tracks: upgradeTracks(raw.tracks) };
    } catch { /* corrupted */ }
    return null;
  })(),
  forYouLoading: false,

  // ---- network-adaptive quality ----
  networkInfo: { effectiveType: null, downlink: null, rtt: null, saveData: false, quality: 'high', reason: 'auto' },
  effectiveYtQuality: String(persistedSettings.ytQuality || 'high'),
  stallCount: 0,
  lastStallAt: 0,
  stallWindowStart: 0,

  // ---- gapless preload (mirrors module `preloaded`) ----
  preloadedIndex: -1,
  preloadedTrackId: null,
  gaplessStatus: 'off',

  // ---- offline downloads (IndexedDB blobs) ----
  offlineIds: [],
  downloadingIds: [],

  // ---- Listen Together ----
  together: { code: null, memberId: null, name: '', isHost: false, members: [], messages: [], remoteVersion: 0, lastSyncAt: 0 },
  togetherApplyingRemote: false,

  // Core slice (toast + navigation) — behavior in `store/toastNav.js`.
  ...createToastNavSlice(set, get),

  setInstallAvailable(v) { set({ installAvailable: Boolean(v) }); },
  async promptInstall() {
    try {
      const evt = pendingInstallPrompt;
      if (!evt) return false;
      evt.prompt();
      const choice = await evt.userChoice;
      pendingInstallPrompt = null;
      set({ installAvailable: false });
      return choice?.outcome === 'accepted';
    } catch { return false; }
  },
  requestSearchFocus() { set((s) => ({ searchFocusTick: s.searchFocusTick + 1 })); },
  setSearchQuery(searchQuery) { set({ searchQuery }); },

  // Guests are driven by the host — used by every local playback/queue
  // request so guests can never diverge queue/index/audio.
  _guestBlocked() {
    const tg = get().together;
    if (tg?.code && !tg.isHost && !get().togetherApplyingRemote) {
      get().toast('Listen Together', 'You are a guest — playback is controlled by the host.');
      return true;
    }
    return false;
  },

  // ---------- core playback ----------
  currentTrack() {
    const { queue, index } = get();
    return index >= 0 && index < queue.length ? queue[index] : null;
  },

  playTrack(track, contextList) {
    if (get()._guestBlocked()) return;
    const list = Array.isArray(contextList) && contextList.length ? contextList : [track];
    let index = list.findIndex((t) => sameTrack(t, track));
    if (index < 0) index = 0;
    set({ queue: list.slice(), index, shuffleBackup: null, shuffle: false });
    get()._loadAndPlay(index, list);
  },

  playTracks(list, startIndex = 0, { shuffle = false } = {}) {
    if (get()._guestBlocked()) return;
    if (!list?.length) return;
    if (shuffle) {
      const first = list[startIndex] || list[0];
      const rest = shuffled(list.filter((_, i) => i !== startIndex));
      set({ queue: [first, ...rest], index: 0, shuffle: true, shuffleBackup: list.slice() });
      get()._loadAndPlay(0, [first, ...rest]);
    } else {
      set({ queue: list.slice(), index: startIndex, shuffle: false, shuffleBackup: null });
      get()._loadAndPlay(startIndex, list);
    }
  },

  playIndex(i) {
    if (get()._guestBlocked()) return;
    const { queue } = get();
    if (i < 0 || i >= queue.length) return;
    set({ index: i });
    get()._loadAndPlay(i, queue);
  },

  _resolveTrackUrl(track) {
    if (!track) return { url: null, useAddon: false, orphan: false };
    const enabledBases = new Set(get().enabledAddons().map((a) => a.manifest.base));
    const useAddon = Boolean(track.isAddon && track.addonBase && enabledBases.has(track.addonBase));
    const addonManifest = (get().settings.addons || []).find((a) => a.manifest?.base === track.addonBase)?.manifest || null;
    const orphan = Boolean(track.isAddon && !useAddon);
    const url = useAddon
      ? addonTrackUrl(track.addonBase, track.id, track.audioQuality || addonManifest?.defaultQuality || 'LOSSLESS')
      : streamSrc(track.id, get().effectiveYtQuality || get().settings?.ytQuality || 'high');
    return { url, useAddon, orphan, addonManifest };
  },

  // Silence BOTH engines — stream <audio> and the embed iframe. Without
  // this, switching engines mid-playback leaves the old engine audible.
  _stopBothEngines() {
    try { activeAudio().pause(); } catch { /* noop */ }
    try { inactiveAudio().pause(); } catch { /* noop */ }
    try { embedBridge.player?.pauseVideo?.(); } catch { /* noop */ }
  },

  async _loadAndPlay(index, list, { fromGapless = false } = {}) {
    // Guests are driven by the host — ignore local playback requests.
    if (get().together?.code && !get().together?.isHost && !get().togetherApplyingRemote) {
      get().toast('Listen Together', 'You are a guest — playback is controlled by the host.');
      return;
    }
    const track = list[index];
    if (!track) return;

    // Invalidate any pending fade transition and reset audio completely
    transitionToken += 1;
    const token = transitionToken;
    fadingOut = false;
    clearFadeTimer();
    preloaded = null;
    set({ preloadedIndex: -1, preloadedTrackId: null, gaplessStatus: get().settings?.gapless?.enabled && !isEmbedEngine(get()) ? 'idle' : 'off' });
    get()._stopBothEngines();
    const el = activeAudio();
    el.removeAttribute('src');
    el.currentTime = 0;

    // Offline first: if this track is downloaded, play its blob.
    let offlineUrl = null;
    try { offlineUrl = await getOfflineUrl(track.id); } catch { offlineUrl = null; }
    if (token !== transitionToken) return; // superseded by a newer load
    const { url: networkUrl, useAddon, orphan } = get()._resolveTrackUrl(track);
    const url = offlineUrl || networkUrl;

    // Orphan addon track: saved in queue/history while an addon was on,
    // but that addon is now disabled/removed. Its ID (Qobuz/Deezer) is not
    // a valid YouTube ID — fail over to another enabled addon, then YouTube.
    if (orphan) {
      set({
        isReady: false,
        trackLoading: true,
        streamError: null,
        currentTime: 0,
        duration: track.duration || 0,
        lyricsOffset: 0,
        segments: [],
        segmentsFor: track.id,
        ignoreSegmentUuid: null,
      });
      get()._recordHistory(track);
      get()._failoverTrack(track, index, track._triedAddons || []);
      return;
    }

    set({
      isReady: false,
      trackLoading: true,
      streamError: null,
      currentTime: 0,
      duration: track.duration || 0,
      lyricsOffset: 0,
      segments: [],
      segmentsFor: track.id,
      chapters: [],
      chaptersFor: track.id,
      ignoreSegmentUuid: null,
      abLoop: { a: null, b: null },
    });
    get()._recordHistory(track);
    void get()._fetchSegments(track);
    void get()._fetchChapters(track);

    if (!offlineUrl && !useAddon && isEmbedEngine(get())) {
      // YouTube IFrame engine — plays straight through youtube.com, no proxy needed
      embedBridge.pendingId = track.id;
      embedBridge.loadedId = track.id;
      embedBridge.wantsPlay = true;
      if (embedBridge.ready && embedBridge.player) {
        try { embedBridge.player.loadVideoById(track.id); } catch { /* cue on next ready */ }
      }
      set({ isPlaying: false });
      write('cl:queue', { queue: get().queue, index, position: 0 });
      get()._togetherPushState?.();
      get()._notifyNowPlaying?.(track);
      return;
    }

    el.src = url;
    // Restore per-track speed memory.
    let rate = get().playbackRate || 1;
    try {
      const map = readMigrated('cl:rateByTrack', {}) || {};
      if (Number.isFinite(map[track.id])) rate = Math.max(0.25, Math.min(4, map[track.id]));
    } catch { /* ignore */ }
    el.playbackRate = rate;
    if (rate !== (get().playbackRate || 1)) set({ playbackRate: rate });
    el.volume = get()._targetVolume();
    getAnalyser();
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
    const p = el.play();
    if (p?.catch) p.catch(() => {
      set({ isPlaying: false, trackLoading: false });
      get().toast('Playback blocked', 'Press play to start the stream.');
    });
    set({ isPlaying: true });
    write('cl:queue', { queue: get().queue, index, position: 0 });
    get()._fadeInIfEnabled();
    get()._togetherPushState?.();
    get()._togetherPushPresence?.();
    get()._notifyNowPlaying?.(track);
  },

  // ---------- For You AI Mix ----------
  async generateForYouMix({ fetchDiscovery = true } = {}) {
    if (get().forYouLoading) return get().forYou;
    const { history, liked, playlists } = get();
    set({ forYouLoading: true });
    const built = buildForYouMix({ history, liked, playlists, limit: 20, now: Date.now() });
    let tracks = built.tracks.slice();
    let reason = built.reason || 'Based on your listening';
    if (fetchDiscovery && built.topArtists?.length && tracks.length) {
      try {
        const region = get()._regionForSearch?.() || {};
        const q = built.topArtists[0];
        const res = await apiSearch(q, { limit: 12, gl: region.gl, hl: region.hl });
        const existing = new Set(tracks.map((t) => t.id));
        const fresh = (res?.results || [])
          .filter((t) => t?.id && !existing.has(t.id) && t.kind !== 'artist' && t.kind !== 'album')
          .slice(0, 4);
        if (fresh.length) {
          tracks = [...tracks, ...fresh].slice(0, 20);
          reason = `${reason} · +${fresh.length} fresh from ${q}`;
        }
      } catch { /* discovery is best-effort */ }
    }
    const forYou = { tracks, topArtists: built.topArtists || [], reason, stats: built.stats || {}, generatedAt: Date.now() };
    set({ forYou, forYouLoading: false });
    try { write('cl:forYou', forYou); } catch { /* storage full */ }
    return forYou;
  },

  // ---------- desktop shell (Electron only) ----------
  // Sync the two desktop-only prefs with the Electron main process, and
  // wire tray menu commands (Play/Pause, Next) into the player.
  _initDesktop() {
    if (typeof window === 'undefined' || !window.chordless?.isDesktop) return;
    const s = get();
    window.chordless.getPrefs().then((prefs) => {
      if (!prefs) return;
      const next = { ...(get().settings || {}) };
      if (typeof prefs.closeToTray === 'boolean') next.closeToTray = prefs.closeToTray;
      if (typeof prefs.openAtLogin === 'boolean') next.openAtLogin = prefs.openAtLogin;
      usePlayer.setState({ settings: next });
      try { write('cl:settings', next); } catch { /* ignore */ }
    }).catch(() => { /* non-desktop context */ });
    window.chordless.onTrayCommand((command) => {
      const st = get();
      if (command === 'togglePlay') st.togglePlay();
      if (command === 'next') st.next(true);
    });
  },

  // ---------- song notifications (Notification API) ----------
  // Background by default; foreground needs the second toggle.
  setSongNotification(patch) {
    const s = get().settings || {};
    updateSettings({ ...patch });
    const enabled = Boolean(patch.notifyBackground || patch.notifyForeground);
    if (enabled && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const patchKeys = Object.keys(patch);
      const revert = () => {
        const next = { ...get().settings };
        for (const k of patchKeys) next[k] = false;
        usePlayer.setState({ settings: next });
        try { write('cl:settings', next); } catch { /* ignore */ }
      };
      Notification.requestPermission()
        .then((perm) => {
          if (perm !== 'granted') {
            revert();
            get().toast('Notifications are blocked', 'Enable notifications to use this');
          }
        })
        .catch(() => revert());
    }
  },

  _notifyNowPlaying(track) {
    try {
      if (!track) return;
      const s = get().settings || {};
      const focused = typeof document !== 'undefined' ? document.hasFocus() : false;
      const allowed = focused ? Boolean(s.notifyForeground) : Boolean(s.notifyBackground);
      if (!allowed) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      new Notification(track.title || 'Chordless', {
        body: track.artist || '',
        icon: track.thumbnail || undefined,
        tag: 'chordless-now-playing',
        silent: true,
      });
    } catch { /* notifications are best-effort */ }
  },

  // ---------- network-adaptive quality ----------
  _recomputeEffectiveQuality(reason = 'auto') {
    const manual = get().settings?.ytQuality || 'high';
    const net = get().networkInfo?.quality || 'high';
    const effective = get().settings?.adaptiveQuality === false ? manual : lowerQuality(manual, net);
    if (get().effectiveYtQuality !== effective) {
      set({ effectiveYtQuality: effective });
      if (reason === 'stalls') get().toast('Network slow', `Lowered quality to ${effective} for smoother playback (next track).`);
    }
    return effective;
  },
  refreshNetworkInfo(reason = 'auto') {
    const nowMs = Date.now();
    if ((get().stallWindowStart || 0) && nowMs - get().stallWindowStart > 60000) {
      set({ stallCount: 0, stallWindowStart: 0 });
    }
    const snap = connectionSnapshot();
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
    const stallLevel = Math.min(2, Math.floor((get().stallCount || 0) / 2));
    const { quality, reason: why } = qualityFromConnection(conn, stallLevel);
    set({ networkInfo: { ...snap, quality, reason: why } });
    get()._recomputeEffectiveQuality(reason);
  },
  initNetworkAdaptive() {
    get().refreshNetworkInfo();
    try {
      const conn = navigator.connection;
      if (conn && 'addEventListener' in conn) {
        const onChange = () => get().refreshNetworkInfo('connection');
        conn.addEventListener('change', onChange);
        // best-effort RTT probe against our own backend
        fetch(`/api/health?probe=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => {});
      }
    } catch { /* Network Information API unavailable */ }
    // Probe interval: every 60s re-check (cheap, keeps rtt/downlink fresh)
    get()._networkProbeTimer && clearInterval(get()._networkProbeTimer);
    const t = setInterval(() => get().refreshNetworkInfo('timer'), 60000);
    set({ _networkProbeTimer: t });
  },
  _noteStall() {
    if (!get().isPlaying) return;
    const now = Date.now();
    const last = get().lastStallAt || 0;
    if (now - last < 2000) return;
    let count = get().stallCount || 0;
    let windowStart = get().stallWindowStart || now;
    if (now - windowStart > 30000) { count = 0; windowStart = now; }
    count += 1;
    set({ stallCount: count, lastStallAt: now, stallWindowStart: windowStart });
    if (count >= 2 && get().settings?.adaptiveQuality !== false) {
      get().refreshNetworkInfo('stalls');
    }
  },
  setAdaptiveQuality(enabled) {
    get().updateSettings({ adaptiveQuality: Boolean(enabled) });
    get().refreshNetworkInfo('toggle');
  },

  // ---------- crossfade (fade transition, Stream engine only) ----------
  // Single-element fade: fade out near the end of the track, fade in on
  // the next one. No overlap and no async/await — plain intervals only.
  _crossfadeConfig() {
    const cf = get().settings?.crossfade || {};
    const gapless = get().settings?.gapless || {};
    const duration = [3, 5, 8, 12].includes(Number(cf.duration)) ? Number(cf.duration) : 5;
    // Gapless replaces crossfade (instant swap, no fade) — never both.
    const gaplessOn = Boolean(gapless.enabled) && !isEmbedEngine(get());
    return { enabled: Boolean(cf.enabled) && !gaplessOn && !isEmbedEngine(get()), duration, gaplessOn };
  },

  // Single source of truth: the element volume ALWAYS mirrors the stored
  // level. Mute is signalled only via the `muted` flag/property — never by
  // writing 0 into volume. (Writing 0 here caused un-mute to restore a
  // wrong level whenever a load/fade path ran while muted.)
  _targetVolume() {
    const s = get();
    return clamp01(s.volume ?? 0.8);
  },

  _fadeTo(target, ms) {
    clearFadeTimer();
    const to = clamp01(target);
    const from = activeAudio().volume;
    const total = Math.max(0, Number(ms) || 0);
    if (total <= 0 || Math.abs(to - from) < 0.001) {
      activeAudio().volume = to;
      return;
    }
    const start = Date.now();
    const stepMs = 40;
    fadeTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      const k = Math.min(1, elapsed / total);
      activeAudio().volume = from + (to - from) * k;
      if (k >= 1) clearFadeTimer();
    }, stepMs);
  },

  _fadeInIfEnabled() {
    const cf = get()._crossfadeConfig();
    if (!cf.enabled) {
      // No fade: restore normal volume immediately
      clearFadeTimer();
      fadingOut = false;
      activeAudio().volume = get()._targetVolume();
      return;
    }
    fadingOut = false;
    activeAudio().volume = 0;
    get()._fadeTo(get()._targetVolume(), cf.duration * 1000);
  },

  _maybeStartFadeOut() {
    const cf = get()._crossfadeConfig();
    if (!cf.enabled || fadingOut || !get().isPlaying) return;
    const d = activeAudio().duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const t = activeAudio().currentTime || 0;
    const remaining = d - t;
    if (cf.duration <= 0 || remaining <= 0 || remaining > cf.duration) return;
    fadingOut = true;
    const fadeMs = Math.max(200, Math.min(cf.duration * 1000, remaining * 1000));
    get()._fadeTo(0, fadeMs);
  },

  setCrossfade(patch) {
    const prev = get().settings?.crossfade || { enabled: false, duration: 5 };
    const next = { ...prev, ...patch };
    if (![3, 5, 8, 12].includes(Number(next.duration))) next.duration = 5;
    get().updateSettings({ crossfade: next });
    // If crossfade is turned off mid-fade, restore volume immediately.
    if (!next.enabled) {
      clearFadeTimer();
      fadingOut = false;
      activeAudio().volume = get()._targetVolume();
    }
  },

  // ---------- gapless + preload (Stream engine only) ----------
  _gaplessConfig() {
    const g = get().settings?.gapless || {};
    const preloadSeconds = [10, 20, 30].includes(Number(g.preloadSeconds)) ? Number(g.preloadSeconds) : 20;
    const enabled = Boolean(g.enabled) && !isEmbedEngine(get());
    return { enabled, preloadSeconds };
  },
  setGapless(patch) {
    const prev = get().settings?.gapless || { enabled: false, preloadSeconds: 20 };
    const next = { ...prev, ...patch };
    if (![10, 20, 30].includes(Number(next.preloadSeconds))) next.preloadSeconds = 20;
    get().updateSettings({ gapless: next });
    if (!next.enabled) {
      preloaded = null;
      try { inactiveAudio().pause(); inactiveAudio().removeAttribute('src'); } catch { /* ignore */ }
      set({ preloadedIndex: -1, preloadedTrackId: null, gaplessStatus: 'off' });
    } else {
      // Gapless replaces crossfade — turn crossfade off to avoid double fades.
      if (get().settings?.crossfade?.enabled) {
        const cf = { ...(get().settings.crossfade || {}), enabled: false };
        get().updateSettings({ crossfade: cf });
        clearFadeTimer();
        fadingOut = false;
        activeAudio().volume = get()._targetVolume();
      }
      set({ gaplessStatus: 'idle' });
    }
  },
  _nextIndexForGapless() {
    const { queue, index, repeat } = get();
    if (!queue.length || index < 0) return null;
    if (repeat === 'one') return null;
    if (index < queue.length - 1) return index + 1;
    if (repeat === 'all') return 0;
    return null; // end + autoplay/radio is dynamic — cannot preload
  },
  _maybePreloadNext() {
    const cfg = get()._gaplessConfig();
    if (!cfg.enabled) { if (get().gaplessStatus !== 'off') set({ gaplessStatus: 'off' }); return; }
    if (!get().isPlaying) return;
    const nextIndex = get()._nextIndexForGapless();
    if (nextIndex == null) return;
    if (preloaded && preloaded.forIndex === nextIndex) return;
    const el = activeAudio();
    const d = el.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const remaining = d - (el.currentTime || 0);
    if (remaining > cfg.preloadSeconds) return;
    const track = get().queue[nextIndex];
    if (!track) return;
    // Offline downloads preload their blob URL — never the network URL
    // (which would stall or fail offline). getOfflineUrl is async; the
    // `preloadBusy` flag prevents duplicate spawns from the 250ms timer.
    if (preloadBusy.forIndex === nextIndex) return;
    preloadBusy = { forIndex: nextIndex };
    (async () => {
      try {
        let url = null;
        let orphan = false;
        try {
          const offlineUrl = await getOfflineUrl(track.id);
          if (offlineUrl) url = offlineUrl;
        } catch { /* IndexedDB unavailable */ }
        if (!url) {
          const resolved = get()._resolveTrackUrl(track);
          url = resolved.url;
          orphan = resolved.orphan;
        }
        if (orphan || !url) return;
        // The world may have moved on while we awaited — revalidate.
        if (get()._nextIndexForGapless() !== nextIndex) return;
        if (preloaded && preloaded.forIndex === nextIndex) return;
        const nxt = inactiveAudio();
        nxt.src = url;
        nxt.preload = 'auto';
        nxt.playbackRate = get().playbackRate || 1;
        nxt.volume = 0; // preloads silently; volume restored on promote
        nxt.load();
        preloaded = { forIndex: nextIndex, trackId: track.id, url, slot: getActiveSlot() === 'A' ? 'B' : 'A' };
        set({ preloadedIndex: nextIndex, preloadedTrackId: track.id, gaplessStatus: 'preloading' });
      } finally {
        preloadBusy = { forIndex: null };
      }
    })().catch(() => { /* best-effort preload */ });
  },
  _promotePreload() {
    if (!preloaded) return false;
    const { forIndex, trackId } = preloaded;
    const { queue, index } = get();
    if (forIndex !== index + 1) return false;
    // Repeat-one wins over a pending preload — never advance past it.
    if (get().repeat === 'one') return false;
    const track = queue[forIndex];
    if (!track || track.id !== trackId) return false;
    const nextEl = inactiveAudio();
    if (!nextEl.src) return false; // async preload still in flight
    // Swap which element is active, then play the preloaded bytes.
    // activeSlot is module-level; promote then re-read activeAudio().
    // eslint-disable-next-line no-assign-after-explicit-operations
    activeSlot = preloaded.slot;
    const el = activeAudio();
    el.volume = get()._targetVolume();
    // Restore per-track speed memory (same rule as _loadAndPlay).
    let rate = get().playbackRate || 1;
    try {
      const map = readMigrated('cl:rateByTrack', {}) || {};
      if (Number.isFinite(map[track.id])) rate = Math.max(0.25, Math.min(4, map[track.id]));
    } catch { /* ignore */ }
    el.playbackRate = rate;
    if (rate !== (get().playbackRate || 1)) set({ playbackRate: rate });
    const p = el.play();
    if (p?.catch) p.catch(() => { /* will surface via handleError */ });
    preloaded = null;
    set({
      index: forIndex,
      isPlaying: true,
      isReady: false,
      trackLoading: false,
      currentTime: 0,
      duration: track.duration || 0,
      lyricsOffset: 0,
      segments: [],
      segmentsFor: track.id,
      chapters: [],
      chaptersFor: track.id,
      ignoreSegmentUuid: null,
      abLoop: { a: null, b: null },
      preloadedIndex: -1,
      preloadedTrackId: null,
      gaplessStatus: 'ready',
    });
    get()._recordHistory(track);
    void get()._fetchSegments(track);
    void get()._fetchChapters(track);
    write('cl:queue', { queue: get().queue, index: forIndex, position: 0 });
    get()._togetherPushState?.();
    // old element is now inactive — clear it for the following preload
    try { inactiveAudio().pause(); inactiveAudio().removeAttribute('src'); inactiveAudio().currentTime = 0; } catch { /* ignore */ }
    return true;
  },

  // ---------- Listen Together (host-authoritative sync) ----------
  async createTogetherRoom(name) {
    const clean = String(name || 'Host').trim().slice(0, 40) || 'Host';
    try {
      const res = await apiTogetherCreate(clean);
      set({ together: { code: res.code, memberId: res.memberId, name: clean, isHost: true, members: res.room?.members || [], messages: res.room?.messages || [], remoteVersion: res.room?.state?.version || 0, lastSyncAt: Date.now() } });
      get().toast('Room created', `Share code ${res.code} — others join with the same code.`);
      get()._togetherPushState();
      return res;
    } catch (e) {
      get().toast('Could not create room', e.message || 'Check the backend connection.');
      return null;
    }
  },
  async joinTogetherRoom(code, name) {
    const cleanName = String(name || 'Guest').trim().slice(0, 40) || 'Guest';
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) { get().toast('Missing code', 'Enter the 5-letter room code.'); return null; }
    try {
      const res = await apiTogetherJoin(cleanCode, cleanName);
      set({ together: { code: res.code, memberId: res.memberId, name: cleanName, isHost: false, members: res.room?.members || [], messages: res.room?.messages || [], remoteVersion: res.room?.state?.version || 0, lastSyncAt: Date.now() } });
      get().toast('Joined room', `Room ${res.code} — following the host.`);
      get()._togetherPollOnce();
      return res;
    } catch (e) {
      get().toast('Could not join room', e.message || 'Check the code and try again.');
      return null;
    }
  },
  async leaveTogetherRoom() {
    const { together } = get();
    if (!together?.code) return;
    try { await apiTogetherPresence(together.code, together.memberId, null); } catch { /* best-effort */ }
    try { await apiTogetherLeave(together.code, together.memberId); } catch { /* best-effort */ }
    set({ together: { code: null, memberId: null, name: '', isHost: false, members: [], messages: [], remoteVersion: 0, lastSyncAt: 0 } });
    get().toast('Left room', 'Back to solo listening.');
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
      if (messages.length !== (together.messages || []).length) {
        set((prev) => ({ together: { ...prev.together, messages } }));
      }
      if (version !== together.remoteVersion || !wasHost && isHostNow) {
        set((prev) => ({ together: { ...prev.together, members, isHost: isHostNow, remoteVersion: version, lastSyncAt: Date.now() } }));
        if (!isHostNow && !get().togetherApplyingRemote) {
          const track = remote.track;
          const queue = Array.isArray(remote.queue) ? remote.queue : [];
          const index = Number.isInteger(remote.index) ? remote.index : -1;
          const current = get().currentTrack();
          if (track && queue.length && (current?.id !== track.id || get().index !== index)) {
            set({ togetherApplyingRemote: true });
            set({ queue: queue.slice(), index, shuffleBackup: null, shuffle: false });
            get()._loadAndPlay(index, queue.slice());
            set({ togetherApplyingRemote: false });
          } else if (track && current?.id === track.id) {
            // Same song: correct play/pause drift only.
            if (Boolean(remote.isPlaying) !== get().isPlaying) {
              set({ togetherApplyingRemote: true });
              if (remote.isPlaying) {
                const el = activeAudio();
                if (!el.src) get()._loadAndPlay(get().index, get().queue);
                else { el.play().catch(() => {}); set({ isPlaying: true }); }
              } else {
                activeAudio().pause();
                set({ isPlaying: false });
              }
              set({ togetherApplyingRemote: false });
            }
          }
        } else {
          set((prev) => ({ together: { ...prev.together, members, isHost: isHostNow } }));
        }
      } else if (members.length !== together.members.length) {
        set((prev) => ({ together: { ...prev.together, members, lastSyncAt: Date.now() } }));
      }
      // Drift correction for guests already on the right track.
      if (!get().together?.isHost && remote.track && get().currentTrack()?.id === remote.track.id && remote.isPlaying) {
        const anchor = remote.updatedAt || Date.now();
        const hostTime = (remote.currentTime || 0) + (Date.now() - anchor) / 1000;
        const local = get().currentTime || 0;
        if (Math.abs(hostTime - local) > 1.5 && hostTime >= 0) {
          set({ togetherApplyingRemote: true });
          try { activeAudio().currentTime = hostTime; set({ currentTime: hostTime }); } catch { /* ignore */ }
          set({ togetherApplyingRemote: false });
        }
      }
    } catch (e) {
      if (e.message && e.message.includes('404')) {
        set({ together: { code: null, memberId: null, name: '', isHost: false, members: [], messages: [], remoteVersion: 0, lastSyncAt: 0 } });
        get().toast('Room closed', 'The host left — back to solo listening.');
      }
    }
  },

  // ---------- SponsorBlock ----------
  async _fetchChapters(track) {
    if (!track?.id || track.isAddon) {
      if (get().chaptersFor === track?.id) set({ chapters: [] });
      return;
    }
    try {
      const data = await apiChapters(track.id);
      if (get().chaptersFor !== track.id && get().segmentsFor !== track.id) return; // user moved on
      set({ chapters: Array.isArray(data?.chapters) ? data.chapters : [] });
    } catch {
      if (get().chaptersFor === track.id) set({ chapters: [] });
    }
  },
  async _fetchSegments(track) {
    const cats = sbCategories(get().settings);
    if (!cats.length || track.isAddon) {
      if (get().segmentsFor === track.id) set({ segments: [] });
      return;
    }
    try {
      const data = await apiSponsorBlock(track.id, cats);
      if (get().segmentsFor !== track.id) return; // user moved on - discard
      set({ segments: Array.isArray(data?.segments) ? data.segments : [] });
    } catch {
      if (get().segmentsFor === track.id) set({ segments: [] });
    }
  },

  _checkSkipSegments(t) {
    const { segments, ignoreSegmentUuid, settings } = get();
    if (settings?.sb?.enabled === false || !segments?.length || !Number.isFinite(t)) return;
    const seg = segments.find((s) => t >= s.start && t < s.end - 0.05);
    if (!seg) return;
    if (ignoreSegmentUuid && seg.uuid && ignoreSegmentUuid === seg.uuid) return;
    get().seekTo(seg.end);
    const label = SB_LABELS[seg.category] || 'Segment';
    get().toast('Skipped', label, { label: 'Undo', onClick: () => get().undoSbSkip(seg.uuid, seg.start) });
  },

  undoSbSkip(uuid, start) {
    set({ ignoreSegmentUuid: uuid || null });
    get().seekTo(Math.max(0, (start || 0) - 0.05));
  },

  togglePlay() {
    const { queue, index, isPlaying } = get();
    if (!queue.length || index < 0) {
      // nothing loaded — play something from home is the caller's concern
      return;
    }
    if (get().together?.code && !get().together?.isHost && !get().togetherApplyingRemote) {
      get().toast('Listen Together', 'You are a guest — playback is controlled by the host.');
      return;
    }
    if (isEmbedEngine(get())) {
      const s = get();
      const p = embedBridge.player;
      const current = s.queue[s.index];
      if (s.isPlaying) {
        try { p?.pauseVideo(); } catch { /* player not ready */ }
        set({ isPlaying: false });
        get()._togetherPushState?.();
        return;
      }
      if (!current) return;
      // Stream engine must not keep playing alongside the embed.
      try { activeAudio().pause(); inactiveAudio().pause(); } catch { /* noop */ }
      if (!embedBridge.ready || embedBridge.loadedId !== current.id) {
        s._loadAndPlay(s.index, s.queue);
        set({ isPlaying: true });
        return;
      }
      try { p?.playVideo(); } catch { return; }
      set({ isPlaying: true });
      get()._togetherPushState?.();
      return;
    }
    if (isPlaying) { clearFadeTimer(); get()._stopBothEngines(); set({ isPlaying: false }); }
    else {
      // Embed engine must not keep playing alongside the stream.
      try { embedBridge.player?.pauseVideo?.(); } catch { /* noop */ }
      getAnalyser();
      if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
      if (!activeAudio().src) get()._loadAndPlay(index, queue);
      else {
        // If we paused mid fade-out, fade back in instead of staying quiet.
        const cf = get()._crossfadeConfig();
        const needFade = cf.enabled && fadingOut;
        if (needFade) {
          fadingOut = false;
          get()._fadeTo(get()._targetVolume(), cf.duration * 1000);
        } else if (cf.enabled) {
          clearFadeTimer();
          activeAudio().volume = get()._targetVolume();
        }
        activeAudio().play().catch(() => {});
      }
      set({ isPlaying: true });
    }
    get()._togetherPushState?.();
  },

  // ---------- autoplay / radio ----------
  // When the queue ends naturally, fetch similar tracks (same artist first,
  // then title) and keep playing instead of stopping.
  generateRadio(fromTrack) {
    const track = fromTrack || get().currentTrack();
    if (!track) return;
    const token = transitionToken;
    set({ trackLoading: true });
    const queries = [
      track.artist && track.artist !== 'Unknown artist' ? track.artist : '',
      `${track.title} ${track.artist || ''}`.trim(),
      track.title,
    ].filter(Boolean);
    const seen = new Set(get().queue.map((t) => t.id));
    const collect = (results) => {
      const picked = [];
      for (const t of (results || [])) {
        if (!t?.id || seen.has(t.id)) continue;
        if (t.kind && t.kind !== 'song') continue;
        seen.add(t.id);
        picked.push(t);
        if (picked.length >= 10) break;
      }
      return picked;
    };
    const run = (i) => {
      if (token !== transitionToken) return;
      if (i >= queries.length) {
        set({ trackLoading: false });
        return;
      }
      const region = get()._regionForSearch?.() || {};
      apiSearch(queries[i], { limit: 20, gl: region.gl, hl: region.hl })
        .then((res) => {
          if (token !== transitionToken) return;
          const picked = collect(res?.results || []);
          if (picked.length >= 5 || i === queries.length - 1) {
            if (picked.length) {
              const newQueue = [...get().queue, ...picked];
              const newIndex = get().index + 1;
              set({ queue: newQueue });
              get().toast('Radio on', `Continuing with ${picked.length} similar tracks.`);
              get().playIndex(newIndex);
            } else {
              set({ trackLoading: false });
              get().toast('Radio ended', 'No more similar tracks found.');
            }
          } else {
            run(i + 1);
          }
        })
        .catch(() => { if (token === transitionToken) run(i + 1); });
    };
    run(0);
  },

  // Resolve current region for search (used by radio + failover).
  _regionForSearch() {
    try {
      const override = get().settings?.region || 'auto';
      // Inline (no import to keep store dependency-light): reuse persisted logic.
      if (override && override !== 'auto') {
        const HL_BY_GL = { ID: 'id', MY: 'ms', SG: 'en', TH: 'th', VN: 'vi', PH: 'fil', JP: 'ja', KR: 'ko', CN: 'zh', HK: 'zh', TW: 'zh', IN: 'en', AE: 'ar', AU: 'en', NZ: 'en', GB: 'en', US: 'en', CA: 'en', FR: 'fr', DE: 'de', ES: 'es', IT: 'it', NL: 'nl', BR: 'pt', MX: 'es', AR: 'es', EG: 'ar', NG: 'en', ZA: 'en' };
        return { gl: String(override).toUpperCase(), hl: HL_BY_GL[String(override).toUpperCase()] || 'en' };
      }
      const lang = String(navigator.language || 'en-US');
      const parts = lang.split('-');
      const gl = (parts[1] || 'ID').toUpperCase();
      const hl = (parts[0] || 'en').toLowerCase();
      return { gl: /^[A-Z]{2}$/.test(gl) ? gl : 'ID', hl: /^[a-z]{2}$/.test(hl) ? hl : 'en' };
    } catch {
      return { gl: 'ID', hl: 'id' };
    }
  },

  next(manual = true) {
    const { queue, index, repeat } = get();
    if (!queue.length) return;
    if (get().together?.code && !get().together?.isHost && !get().togetherApplyingRemote) {
      get().toast('Listen Together', 'You are a guest — playback is controlled by the host.');
      return;
    }
    if (repeat === 'one' && !manual) {
      // Repeat-one restarts the whole track — kill any A/B loop first,
      // or the tak would loop just the A–B segment forever.
      if (get().abLoop?.a != null || get().abLoop?.b != null) set({ abLoop: { a: null, b: null } });
      if (isEmbedEngine(get())) {
        try { embedBridge.player?.seekTo(0, true); embedBridge.player?.playVideo(); } catch { /* noop */ }
        set({ currentTime: 0, isPlaying: true });
        return;
      }
      // Crossfade fade-out already brought volume to ~0 — fade back in.
      const cf = get()._crossfadeConfig();
      activeAudio().currentTime = 0;
      activeAudio().play().catch(() => {});
      if (cf.enabled) get()._fadeTo(get()._targetVolume(), cf.duration * 1000);
      else { clearFadeTimer(); activeAudio().volume = get()._targetVolume(); }
      fadingOut = false;
      return;
    }
    const atEnd = index >= queue.length - 1;
    if (atEnd) {
      if (repeat === 'all') { get().playIndex(0); return; }
      if (manual) { get().playIndex(0); return; }
      // Autoplay/Radio: keep going with similar tracks instead of stopping.
      if (get().settings?.autoplay) { get().generateRadio(queue[index]); return; }
      if (isEmbedEngine(get())) { try { embedBridge.player?.pauseVideo(); } catch { /* noop */ } }
      else activeAudio().pause();
      clearFadeTimer();
      activeAudio().volume = get()._targetVolume();
      set({ isPlaying: false, currentTime: 0 });
      return;
    }
    get().playIndex(index + 1);
  },

  prev() {
    if (get()._guestBlocked()) return;
    const { index, currentTime } = get();
    if (currentTime > 3) { get().seekTo(0); return; }
    if (index > 0) get().playIndex(index - 1);
    else get().seekTo(0);
  },

  seekTo(t) {
    if (get().together?.code && !get().together?.isHost && !get().togetherApplyingRemote) {
      get().toast('Listen Together', 'You are a guest — playback is controlled by the host.');
      return;
    }
    const d = get().duration || activeAudio().duration || 0;
    const clamped = Math.max(0, Math.min(d || 0, t));
    if (isEmbedEngine(get())) {
      try { embedBridge.player?.seekTo(clamped, true); } catch { /* player not ready */ }
      set({ currentTime: clamped });
      get()._togetherPushState?.();
      return;
    }
    activeAudio().currentTime = clamped;
    set({ currentTime: clamped });
    get()._togetherPushState?.();
  },

  // ---------- AB loop (practice section) ----------
  setABPoint(point) {
    const t = Math.max(0, get().currentTime || 0);
    const ab = get().abLoop || { a: null, b: null };
    if (point === 'a') {
      const next = { a: t, b: ab.b != null && ab.b > t ? ab.b : null };
      set({ abLoop: next });
      get().toast('Loop point A', formatTime(t));
    } else {
      let { a, b } = ab;
      b = t;
      if (a != null && b <= a) { [a, b] = [b, a]; }
      if (a == null) { a = b; b = null; }
      set({ abLoop: { a, b } });
      get().toast(b != null ? 'Loop point B' : 'Loop point set', formatTime(b ?? t));
    }
  },
  clearABLoop() {
    set({ abLoop: { a: null, b: null } });
  },

  skipBy(delta) {
    usePlayer.getState().seekTo((usePlayer.getState().currentTime || 0) + delta);
  },

  setVolume(v) {
    // User interaction wins over any running fade.
    clearFadeTimer();
    fadingOut = false;
    const volume = Math.max(0, Math.min(1, v));
    activeAudio().volume = volume;
    inactiveAudio().volume = volume;
    if (isEmbedEngine(get())) {
      try {
        if (volume === 0) embedBridge.player?.setVolume(0);
        else embedBridge.player?.setVolume(Math.round(volume * 100));
      } catch { /* player not ready */ }
    }
    if (volume > 0) { activeAudio().muted = false; inactiveAudio().muted = false; }
    set({ volume, muted: volume === 0 ? get().muted : false });
    write('cl:volume', volume);
  },

  toggleMute() {
    clearFadeTimer();
    fadingOut = false;
    // Mute state is separate from the stored volume: toggling never
    // rewrites the level, so un-mute always returns to the same volume.
    const muted = !get().muted;
    activeAudio().muted = muted;
    inactiveAudio().muted = muted;
    activeAudio().volume = clamp01(get().volume ?? 0.8);
    inactiveAudio().volume = clamp01(get().volume ?? 0.8);
    if (isEmbedEngine(get())) {
      try {
        if (muted) embedBridge.player?.setVolume(0);
        else embedBridge.player?.setVolume(Math.round(get().volume * 100));
      } catch { /* player not ready */ }
    }
    set({ muted });
  },

  toggleShuffle() {
    if (get()._guestBlocked()) return;
    const { shuffle, queue, index, shuffleBackup } = get();
    if (!queue.length) { set({ shuffle: !shuffle }); return; }
    const current = queue[index];
    if (!shuffle) {
      const rest = smartShuffle(queue.filter((_, i) => i !== index), current?.artist);
      set({ shuffle: true, shuffleBackup: queue.slice(), queue: [current, ...rest], index: 0 });
    } else {
      const backup = shuffleBackup || queue;
      const newIndex = Math.max(0, backup.findIndex((t) => sameTrack(t, current)));
      set({ shuffle: false, shuffleBackup: null, queue: backup.slice(), index: newIndex });
    }
  },

  cycleRepeat() {
    if (get()._guestBlocked()) return;
    const order = ['off', 'all', 'one'];
    const nextRepeat = order[(order.indexOf(get().repeat) + 1) % order.length];
    set({ repeat: nextRepeat });
  },

  setPlaybackRate(rate) {
    activeAudio().playbackRate = rate;
    inactiveAudio().playbackRate = rate;
    if (isEmbedEngine(get())) {
      try { embedBridge.player?.setPlaybackRate?.(rate); } catch { /* rate unsupported for this video */ }
    }
    set({ playbackRate: rate });
    // Remember per-track speed (restored in _loadAndPlay).
    const track = get().currentTrack();
    if (track?.id) {
      try {
        const map = readMigrated('cl:rateByTrack', {}) || {};
        map[track.id] = rate;
        write('cl:rateByTrack', map);
      } catch { /* best-effort */ }
    }
  },

  // ---------- queue management ----------
  addToQueue(track) {
    if (get().together?.code && !get().together?.isHost && !get().togetherApplyingRemote) {
      get().toast('Listen Together', 'You are a guest — queue is controlled by the host.');
      return;
    }
    set((s) => ({
      queue: [...s.queue, track],
      // Keep the un-shuffled backup in sync so disabling shuffle later
      // doesn't lose mutations made while shuffled.
      shuffleBackup: s.shuffle && s.shuffleBackup ? [...s.shuffleBackup, track] : s.shuffleBackup,
    }));
    usePlayer.getState().toast('Added to queue', track.title);
    get()._persistQueue();
    get()._togetherPushState?.();
    preloaded = null;
  },

  playNextInQueue(track) {
    if (get().together?.code && !get().together?.isHost && !get().togetherApplyingRemote) {
      get().toast('Listen Together', 'You are a guest — queue is controlled by the host.');
      return;
    }
    set((s) => {
      const at = s.index + 1;
      const queue = s.queue.slice();
      queue.splice(at, 0, track);
      let shuffleBackup = s.shuffleBackup;
      if (s.shuffle && shuffleBackup) {
        // Mirror into the backup right after the current track there.
        const curAt = shuffleBackup.findIndex((t) => sameTrack(t, queue[s.index]));
        shuffleBackup = shuffleBackup.slice();
        shuffleBackup.splice(curAt >= 0 ? curAt + 1 : shuffleBackup.length, 0, track);
      }
      return { queue, shuffleBackup };
    });
    usePlayer.getState().toast('Will play next', track.title);
    get()._persistQueue();
    get()._togetherPushState?.();
    preloaded = null;
  },

  removeFromQueue(i) {
    if (get()._guestBlocked()) return;
    const { queue, index } = get();
    if (i < 0 || i >= queue.length) return;
    const removed = queue[i];
    const nextQueue = queue.filter((_, idx) => idx !== i);
    // Mirror the removal into the shuffle backup as well.
    const backup = get().shuffleBackup;
    const nextBackup = backup ? backup.filter((t) => !sameTrack(t, removed)) : null;
    let nextIndex = index;
    if (i < index) nextIndex = index - 1;
    else if (i === index) {
      // removed the playing track → play whatever now sits at i
      if (nextQueue.length === 0) {
        clearFadeTimer();
        activeAudio().pause();
        activeAudio().volume = get()._targetVolume();
        set({ queue: [], index: -1, isPlaying: false, currentTime: 0, duration: 0 });
        get()._persistQueue();
        return;
      }
      nextIndex = Math.min(i, nextQueue.length - 1);
      set({ queue: nextQueue, index: nextIndex, shuffleBackup: nextBackup });
      get()._loadAndPlay(nextIndex, nextQueue);
      return;
    }
    set({ queue: nextQueue, index: nextIndex, shuffleBackup: nextBackup });
    get().toast('Removed from queue', removed?.title);
    get()._persistQueue();
  },

  reorderQueue(from, to) {
    if (get()._guestBlocked()) return;
    const { queue, index } = get();
    if (from === to || from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
    const nextQueue = queue.slice();
    const [moved] = nextQueue.splice(from, 1);
    nextQueue.splice(to, 0, moved);
    let nextIndex = index;
    if (index === from) nextIndex = to;
    else if (index > from && index <= to) nextIndex = index - 1;
    else if (index < from && index >= to) nextIndex = index + 1;
    set({ queue: nextQueue, index: nextIndex });
    get()._persistQueue();
  },

  clearQueue() {
    if (get()._guestBlocked()) return;
    const prev = get().queue;
    const prevIndex = get().index;
    clearFadeTimer();
    activeAudio().pause();
    activeAudio().volume = get()._targetVolume();
    set({ queue: [], index: -1, isPlaying: false, currentTime: 0, duration: 0 });
    get()._persistQueue();
    if (prev.length) {
      get().toast('Queue cleared', `${prev.length} tracks`, {
        label: 'Undo',
        onClick: () => {
          // Restore AND reload the track at the old index — otherwise the
          // element/src are stale and Play resumes the wrong thing.
          set({ queue: prev, index: prevIndex });
          get()._persistQueue();
          if (prevIndex >= 0 && prevIndex < prev.length) get()._loadAndPlay(prevIndex, prev);
        },
      });
    }
  },

  saveQueueAsPlaylist() {
    const { queue } = get();
    if (!queue.length) return null;
    const name = `Queue — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    const playlist = get().createPlaylist(name, queue);
    get().toast('Playlist created', `Saved ${queue.length} tracks as “${name}”`);
    return playlist;
  },

  _persistQueue() {
    write('cl:queue', { queue: get().queue, index: get().index, position: get().currentTime || 0 });
  },

  // ---------- queue duration ----------
  queueDuration() {
    return totalDuration(get().queue);
  },
  queueDurationFormatted() {
    return formatTotalDuration(get().queue, get().settings.lang || 'en');
  },

  // ---------- search history ----------
  addSearchHistory(query) {
    const q = String(query || '').trim();
    if (!q || q.length < 2) return;
    const clean = (Array.isArray(get().searchHistory) ? get().searchHistory : []).filter((h) => typeof h === 'string');
    const next = [q, ...clean.filter((h) => String(h).toLowerCase() !== q.toLowerCase())].slice(0, 20);
    set({ searchHistory: next });
    write('cl:searchHistory', next);
  },
  removeSearchHistory(query) {
    const q = String(query || '').trim().toLowerCase();
    const clean = (Array.isArray(get().searchHistory) ? get().searchHistory : []).filter((h) => typeof h === 'string');
    const next = clean.filter((h) => String(h).toLowerCase() !== q);
    set({ searchHistory: next });
    write('cl:searchHistory', next);
  },
  clearSearchHistory() {
    set({ searchHistory: [] });
    write('cl:searchHistory', []);
  },
  saveSearch(query, filter = 'all') {
    const q = String(query || '').trim();
    if (!q || q.length < 2) return;
    const clean = (Array.isArray(get().savedSearches) ? get().savedSearches : []).filter((s) => s?.query);
    if (clean.some((s) => String(s.query).toLowerCase() === q.toLowerCase() && (s.filter || 'all') === filter)) {
      get().toast('Already saved', q);
      return;
    }
    const entry = { id: uid(), query: q, filter, createdAt: Date.now() };
    const next = [entry, ...clean].slice(0, 30);
    set({ savedSearches: next });
    write('cl:savedSearches', next);
    get().toast('Search saved', q);
  },
  removeSavedSearch(id) {
    const clean = (Array.isArray(get().savedSearches) ? get().savedSearches : []).filter((s) => s?.id !== id);
    set({ savedSearches: clean });
    write('cl:savedSearches', clean);
  },

  // ---------- mini player ----------
  toggleMiniPlayer() { set((s) => ({ miniPlayer: !s.miniPlayer })); },
  setMiniPlayer(open) { set({ miniPlayer: open }); },

  // ---------- equalizer ----------
  setEqualizerPreset(preset) {
    const bands = EQ_PRESETS[preset] || EQ_PRESETS.flat;
    set({ equalizerPreset: preset, equalizerBands: bands });
    getAnalyser();
    applyEqualizer(bands.bass, bands.mid, bands.treble);
  },
  setEqualizerBand(band, value) {
    const bands = { ...get().equalizerBands, [band]: value };
    set({ equalizerBands: bands, equalizerPreset: 'custom' });
    getAnalyser();
    applyEqualizer(bands.bass, bands.mid, bands.treble);
  },
  exportEQPreset() {
    const b = get().equalizerBands || { bass: 0, mid: 0, treble: 0 };
    return JSON.stringify({ bass: b.bass, mid: b.mid, treble: b.treble });
  },
  importEQPreset(text) {
    try {
      const data = JSON.parse(String(text || '').trim());
      const clamp = (v) => Math.max(-12, Math.min(12, Math.round(Number(v) || 0)));
      const bands = { bass: clamp(data.bass), mid: clamp(data.mid), treble: clamp(data.treble) };
      set({ equalizerBands: bands, equalizerPreset: 'custom' });
      getAnalyser();
      applyEqualizer(bands.bass, bands.mid, bands.treble);
      get().toast('EQ applied', `Bass ${bands.bass} · Mid ${bands.mid} · Treble ${bands.treble} dB`);
      return true;
    } catch {
      get().toast('Invalid EQ preset', 'Could not parse that JSON.');
      return false;
    }
  },

  // ---------- spatial audio ----------
  setSpatial(patch) {
    const prev = get().settings?.spatial || { enabled: false, width: 1.6 };
    const next = { ...prev, ...patch };
    if (![1.2, 1.6, 2.0, 2.4].includes(Number(next.width))) next.width = 1.6;
    get().updateSettings({ spatial: next });
    getAnalyser();
    applySpatial(next.enabled, next.width);
  },

  // ---------- audio advanced ----------
  setYtQuality(quality) {
    const q = ['high', 'medium', 'low'].includes(quality) ? quality : 'high';
    get().updateSettings({ ytQuality: q });
    get()._recomputeEffectiveQuality('manual');
  },
  setNormalize(enabled) {
    get().updateSettings({ normalize: Boolean(enabled) });
    getAnalyser();
    applyNormalize(Boolean(enabled));
  },
  setBalance(pan) {
    const p = Math.max(-1, Math.min(1, Number(pan) || 0));
    get().updateSettings({ balance: p });
    getAnalyser();
    applyBalance(p);
  },

  // ---------- playlist share / import ----------
  sharePlaylist(playlistId) {
    const playlist = get().playlists.find((p) => p.id === playlistId);
    if (!playlist) return null;
    const data = { name: playlist.name, tracks: playlist.tracks, createdAt: Date.now(), version: 1 };
    const json = JSON.stringify(data, null, 2);
    return navigator.clipboard.writeText(json).then(() => {
      get().toast('Playlist copied', `“${playlist.name}” — paste to import elsewhere`);
      return json;
    });
  },
  async sharePlaylistLink(playlistId) {
    const playlist = get().playlists.find((p) => p.id === playlistId);
    if (!playlist) return null;
    try {
      const res = await apiShareCreate(playlist.name, playlist.tracks);
      const fullUrl = res.url || `${window.location.origin}/share/${res.id}`;
      await navigator.clipboard.writeText(fullUrl);
      get().toast('Share link copied', `“${playlist.name}” — expires in 7 days`);
      return fullUrl;
    } catch (e) {
      get().toast('Share failed', e.message || 'Server unreachable.');
      return null;
    }
  },
  async openSharedPlaylist(id) {
    try {
      const data = await apiShareGet(id);
      if (!data?.tracks?.length) throw new Error('Empty shared playlist');
      const playlist = get().createPlaylist(data.name || 'Shared playlist', data.tracks);
      get().toast('Shared playlist imported', `“${playlist.name}” (${data.tracks.length} tracks)`);
      return playlist;
    } catch (e) {
      get().toast('Share link failed', e.message || 'Link expired or offline.');
      return null;
    }
  },
  importPlaylist(json) {
    try {
      const data = JSON.parse(json);
      if (!data || !data.name || !Array.isArray(data.tracks)) throw new Error('Invalid playlist format');
      const playlist = get().createPlaylist(data.name, data.tracks);
      get().toast('Playlist imported', `“${data.name}” (${data.tracks.length} tracks)`);
      return playlist;
    } catch (err) {
      get().toast('Import failed', err.message || 'Invalid playlist data');
      return null;
    }
  },

  // ---------- lyrics translation ----------
  toggleLyricsTranslation() {
    translateToken += 1; // invalidate any in-flight translation
    set((s) => ({ lyricsTranslation: !s.lyricsTranslation }));
    if (!get().lyricsTranslation) set({ translatedLyrics: null });
  },
  setLyricsTargetLang(lang) {
    translateToken += 1;
    set({ lyricsTargetLang: lang, translatedLyrics: null });
  },
  async translateLyrics(text) {
    const { lyricsTargetLang } = get();
    if (!text || !lyricsTargetLang) return null;
    // Token guard: a late response for a previous track must not
    // repopulate ghost translation text on the current one.
    const token = ++translateToken;
    const trackId = get().currentTrack()?.id || null;
    try {
      const result = await apiTranslate(text, lyricsTargetLang);
      if (token !== translateToken || (get().currentTrack()?.id || null) !== trackId) return null;
      set({ translatedLyrics: result });
      return result.translated;
    } catch {
      if (token !== translateToken || (get().currentTrack()?.id || null) !== trackId) return null;
      set({ translatedLyrics: { translated: text, target: lyricsTargetLang } });
      return text;
    }
  },
  clearTranslatedLyrics() {
    set({ translatedLyrics: null });
  },

  // ---------- export / import library ----------
  exportLibrary() {
    const s = get();
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      liked: s.liked,
      playlists: s.playlists,
      history: s.history,
      queue: { queue: s.queue, index: s.index, position: s.currentTime || 0 },
      settings: s.settings,
      searchHistory: s.searchHistory,
      savedSearches: s.savedSearches,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chordless-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    get().toast('Library exported', 'Backup saved as JSON file.');
  },
  importLibrary(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file');

        const s = get();
        const updates = {};
        if (Array.isArray(payload.liked)) updates.liked = payload.liked;
        if (Array.isArray(payload.playlists)) updates.playlists = payload.playlists.map((p) => ({ ...p, tracks: upgradeTracks(p.tracks || []) }));
        if (Array.isArray(payload.history)) updates.history = upgradePersisted(payload.history);
        if (payload.queue && Array.isArray(payload.queue.queue)) {
          updates.queue = payload.queue.queue.map((t) => ({ ...t, duration: t.duration || 0 }));
          // Clamp: a hand-edited backup with index 999 must not strand the
          // player in an out-of-range state.
          const rawIndex = Number.isInteger(payload.queue.index) ? payload.queue.index : -1;
          updates.index = updates.queue.length === 0 ? -1 : Math.max(0, Math.min(rawIndex, updates.queue.length - 1));
          updates.restorePosition = payload.queue.position || 0;
          updates.hasRestoredQueue = Boolean(payload.queue.queue.length);
        }
        if (payload.settings) updates.settings = { ...persistedSettings, ...payload.settings };
        if (Array.isArray(payload.searchHistory)) updates.searchHistory = payload.searchHistory.slice(0, 20);
        if (Array.isArray(payload.savedSearches)) updates.savedSearches = payload.savedSearches.filter((s) => s?.query && s?.id).slice(0, 30);

        set(updates);
        if (updates.liked) write('cl:liked', updates.liked);
        if (updates.playlists) write('cl:playlists', updates.playlists);
        if (updates.history) write('cl:history', updates.history);
        if (updates.queue) write('cl:queue', { queue: updates.queue, index: updates.index, position: updates.restorePosition });
        if (updates.settings) write('cl:settings', updates.settings);
        if (updates.searchHistory) write('cl:searchHistory', updates.searchHistory);
        if (updates.savedSearches) write('cl:savedSearches', updates.savedSearches);

        get().toast('Library imported', 'Backup restored successfully.');
      } catch (err) {
        get().toast('Import failed', err.message || 'Could not read backup file.');
      }
    };
    reader.readAsText(file);
  },

  // ---------- likes ----------
  toggleLike(track) {
    if (!track?.id) return;
    const exists = get().liked.some((t) => t.id === track.id);
    const liked = exists ? get().liked.filter((t) => t.id !== track.id) : [{ ...track }, ...get().liked];
    set({ liked });
    write('cl:liked', liked);
    get().toast(exists ? 'Removed from Liked Songs' : 'Added to Liked Songs', track.title);
  },
  isLiked(id) { return get().liked.some((t) => t.id === id); },

  // ---------- playlists ----------
  createPlaylist(name, tracks = []) {
    const playlist = { id: uid(), name: (name || 'New Playlist').trim() || 'New Playlist', createdAt: Date.now(), tracks: tracks.map((t) => ({ ...t })) };
    const playlists = [playlist, ...get().playlists];
    set({ playlists });
    write('cl:playlists', playlists);
    return playlist;
  },
  deletePlaylist(id) {
    const deleted = get().playlists.find((p) => p.id === id);
    const playlists = get().playlists.filter((p) => p.id !== id);
    set({ playlists });
    write('cl:playlists', playlists);
    if (get().view?.name === 'playlist' && get().view?.id === id) set({ view: { name: 'home' } });
    get().toast('Playlist deleted', deleted?.name, {
      label: 'Undo',
      onClick: () => {
        if (!deleted) return;
        set({ playlists: [deleted, ...get().playlists] });
        write('cl:playlists', get().playlists);
      },
    });
  },
  renamePlaylist(id, name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    const playlists = get().playlists.map((p) => (p.id === id ? { ...p, name: clean } : p));
    set({ playlists });
    write('cl:playlists', playlists);
  },
  updatePlaylistCover(id, coverUrl) {
    const playlists = get().playlists.map((p) =>
      p.id === id ? { ...p, coverUrl: coverUrl || undefined } : p,
    );
    set({ playlists });
    write('cl:playlists', playlists);
  },
  addToPlaylist(playlistId, track) {
    if (!track?.id) return;
    const target = get().playlists.find((p) => p.id === playlistId);
    const already = target?.tracks.some((t) => t.id === track.id);
    const playlists = get().playlists.map((p) =>
      p.id === playlistId && !already ? { ...p, tracks: [...p.tracks, { ...track }] } : p,
    );
    set({ playlists });
    write('cl:playlists', playlists);
    get().toast(already ? 'Already in playlist' : `Added to “${target?.name || 'playlist'}”`, track.title);
  },
  removeFromPlaylist(playlistId, trackId) {
    const playlists = get().playlists.map((p) =>
      p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p,
    );
    set({ playlists });
    write('cl:playlists', playlists);
  },

  // ---------- playlist tools (sort / dedupe / merge / bulk remove) ----------
  removeDuplicateAcross(trackId, keepPlaylistId) {
    const playlists = get().playlists.map((p) =>
      p.id !== keepPlaylistId && p.tracks.some((t) => t.id === trackId)
        ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
        : p,
    );
    set({ playlists });
    write('cl:playlists', playlists);
  },
  sortPlaylist(playlistId, mode) {
    const target = get().playlists.find((p) => p.id === playlistId);
    if (!target) return;
    const tracks = [...target.tracks];
    if (mode === 'az') tracks.sort((a, b) => a.title.localeCompare(b.title));
    else if (mode === 'za') tracks.sort((a, b) => b.title.localeCompare(a.title));
    else if (mode === 'artist') tracks.sort((a, b) => (a.artist || '').localeCompare(b.artist || '') || a.title.localeCompare(b.title));
    else if (mode === 'duration-desc') tracks.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    else if (mode === 'duration-asc') tracks.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    else return;
    const playlists = get().playlists.map((p) => (p.id === playlistId ? { ...p, tracks } : p));
    set({ playlists });
    write('cl:playlists', playlists);
    get().toast('Playlist sorted', target.name);
  },
  dedupePlaylist(playlistId) {
    const target = get().playlists.find((p) => p.id === playlistId);
    if (!target) return 0;
    const seen = new Set();
    const tracks = target.tracks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    const removed = target.tracks.length - tracks.length;
    if (!removed) {
      get().toast('No duplicates found', target.name);
      return 0;
    }
    const playlists = get().playlists.map((p) => (p.id === playlistId ? { ...p, tracks } : p));
    set({ playlists });
    write('cl:playlists', playlists);
    get().toast('Duplicates removed', `${removed} removed from “${target.name}”`);
    return removed;
  },
  mergePlaylist(targetId, sourceId) {
    const target = get().playlists.find((p) => p.id === targetId);
    const source = get().playlists.find((p) => p.id === sourceId);
    if (!target || !source || targetId === sourceId) return 0;
    const existing = new Set(target.tracks.map((t) => t.id));
    const fresh = source.tracks.filter((t) => !existing.has(t.id));
    const playlists = get().playlists.map((p) =>
      p.id === targetId ? { ...p, tracks: [...p.tracks, ...fresh.map((t) => ({ ...t }))] } : p,
    );
    set({ playlists });
    write('cl:playlists', playlists);
    get().toast('Playlists merged', `${fresh.length} new tracks added to “${target.name}”`);
    return fresh.length;
  },
  removeTracksFromPlaylist(playlistId, trackIds) {
    const drop = new Set(trackIds || []);
    if (!drop.size) return;
    const target = get().playlists.find((p) => p.id === playlistId);
    const playlists = get().playlists.map((p) =>
      p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => !drop.has(t.id)) } : p,
    );
    set({ playlists });
    write('cl:playlists', playlists);
    get().toast('Tracks removed', `${drop.size} removed from “${target?.name || 'playlist'}”`);
  },

  // ---------- offline downloads ----------
  async refreshOffline() {
    try {
      const ids = await listOfflineIds();
      set({ offlineIds: ids });
    } catch { /* IndexedDB unavailable */ }
  },
  async downloadTrack(track) {
    if (!track?.id) return false;
    if (get().offlineIds.includes(track.id)) return true;
    if (get().downloadingIds.includes(track.id)) return false;
    set({ downloadingIds: [...get().downloadingIds, track.id] });
    try {
      const { url, orphan } = get()._resolveTrackUrl(track);
      if (orphan || !url) throw new Error('No playable source for this track.');
      await saveOffline(track, url);
      set({
        offlineIds: [...get().offlineIds, track.id],
        downloadingIds: get().downloadingIds.filter((x) => x !== track.id),
      });
      get().toast('Downloaded for offline', track.title);
      return true;
    } catch (e) {
      set({ downloadingIds: get().downloadingIds.filter((x) => x !== track.id) });
      get().toast('Download failed', e.message || 'Could not save this track.');
      return false;
    }
  },
  async removeOfflineTrack(id) {
    await removeOffline(id);
    set({ offlineIds: get().offlineIds.filter((x) => x !== id) });
    get().toast('Removed from downloads');
  },
  async clearOfflineDownloads() {
    await clearOffline();
    set({ offlineIds: [] });
    get().toast('Downloads cleared', 'All offline audio removed.');
  },

  // ---------- playlist folders ----------
  createFolder(name) {
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) return null;
    const folder = { id: uid(), name: clean, createdAt: Date.now() };
    const folders = [...get().folders, folder];
    set({ folders });
    write('cl:folders', folders);
    get().toast('Folder created', folder.name);
    return folder;
  },
  renameFolder(id, name) {
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) return;
    const folders = get().folders.map((f) => (f.id === id ? { ...f, name: clean } : f));
    set({ folders });
    write('cl:folders', folders);
  },
  deleteFolder(id) {
    const folders = get().folders.filter((f) => f.id !== id);
    const playlists = get().playlists.map((p) => (p.folderId === id ? { ...p, folderId: null } : p));
    set({ folders, playlists });
    write('cl:folders', folders);
    write('cl:playlists', playlists);
    get().toast('Folder deleted');
  },
  setPlaylistFolder(playlistId, folderId) {
    const playlists = get().playlists.map((p) => (p.id === playlistId ? { ...p, folderId: folderId || null } : p));
    set({ playlists });
    write('cl:playlists', playlists);
  },

  // ---------- history ----------
  _recordHistory(track) {
    if (!track?.id) return;
    const prev = get().history.find((t) => t.id === track.id);
    const entry = { ...track, playedAt: Date.now(), playCount: (prev?.playCount || 0) + 1 };
    const history = [entry, ...get().history.filter((t) => t.id !== track.id)].slice(0, 80);
    set({ history });
    write('cl:history', history);
  },
  clearHistory() {
    set({ history: [] });
    write('cl:history', []);
    get().toast('History cleared');
  },

  // ---------- sleep timer ----------
  setSleepTimer(value) {
    // value: null | 'track' | number (minutes)
    if (value == null) { set({ sleepTimer: null }); return; }
    if (value === 'track') { set({ sleepTimer: 'track' }); get().toast('Sleep timer', 'Playback will stop after this track.'); return; }
    const endsAt = Date.now() + value * 60 * 1000;
    set({ sleepTimer: endsAt });
    get().toast('Sleep timer', `Playback will stop in ${value} minutes.`);
  },
  sleepTimerTick() {
    const { sleepTimer } = get();
    if (typeof sleepTimer === 'number' && Date.now() >= sleepTimer) {
      clearFadeTimer();
      // Stop BOTH engines (embed kept playing otherwise).
      get()._stopBothEngines();
      activeAudio().volume = get()._targetVolume();
      set({ isPlaying: false, sleepTimer: null });
      get().toast('Sleep timer', 'Good night. Playback stopped.');
    }
  },

  // ---------- settings / theming ----------
  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    // Keep legacy single-addon field in sync with the multi-addon list.
    if (patch.addons) {
      const addons = Array.isArray(patch.addons) ? patch.addons : [];
      settings.addons = addons;
      settings.addon = addons.find((a) => a.enabled) || addons[0] || { url: '', enabled: false, manifest: null };
    }
    set({ settings });
    write('cl:settings', settings);
    if (patch.theme) document.documentElement.dataset.theme = settings.theme;
  },
  setAccent(accent) { set({ accent }); },

  // ---------- multi-addon (priority list + failover) ----------
  enabledAddons() {
    return (get().settings.addons || []).filter((a) => a.enabled && a.manifest?.base);
  },
  addAddon(entry) {
    const addons = [...(get().settings.addons || []), entry];
    get().updateSettings({ addons });
    get().toast('Addon added', entry.manifest?.name || entry.url);
  },
  removeAddon(index) {
    const addons = (get().settings.addons || []).filter((_, i) => i !== index);
    get().updateSettings({ addons });
    get().toast('Addon removed');
  },
  toggleAddon(index) {
    const addons = (get().settings.addons || []).map((a, i) => (i === index ? { ...a, enabled: !a.enabled } : a));
    get().updateSettings({ addons });
  },
  moveAddon(index, dir) {
    const addons = (get().settings.addons || []).slice();
    const target = index + dir;
    if (target < 0 || target >= addons.length) return;
    [addons[index], addons[target]] = [addons[target], addons[index]];
    get().updateSettings({ addons });
  },

  // Try the next enabled addon for the same song; fall back to YouTube last.
  // triedBases: Set/array of addon bases already attempted for this queue slot.
  _failoverTrack(track, index, triedBases) {
    const tried = new Set(triedBases || []);
    if (track?.addonBase) tried.add(track.addonBase);
    const candidates = get().enabledAddons().filter((a) => !tried.has(a.manifest.base));
    const q = `${track.title} ${track.artist || ''}`.trim();
    const token = transitionToken;
    const tryYouTube = () => {
      if (token !== transitionToken) return;
      if (!q) {
        set({ trackLoading: false, isPlaying: false, streamError: 'No playable source found for this track.' });
        return;
      }
      apiSearch(q)
        .then((res) => {
          if (token !== transitionToken) return;
          const results = res?.results || [];
          const match = results.find((t) => t.kind === 'song') || results[0];
          if (match) {
            const newQueue = get().queue.slice();
            if (index >= 0 && index < newQueue.length) newQueue[index] = match;
            set({ queue: newQueue });
            get().toast('Playing on YouTube', `"${track.title}" — no addon source worked.`);
            get()._loadAndPlay(index, newQueue);
          } else {
            set({ trackLoading: false, isPlaying: false, streamError: 'No playable source found for this track.' });
            get().toast('No playable source', `"${track.title}" — all addons + YouTube failed.`);
          }
        })
        .catch(() => {
          if (token !== transitionToken) return;
          set({ trackLoading: false, isPlaying: false, streamError: 'No playable source found for this track.' });
        });
    };
    if (!candidates.length || !q) { tryYouTube(); return; }
    // Try candidates in priority order, sequentially.
    let i = 0;
    const tryNext = () => {
      if (token !== transitionToken) return;
      if (i >= candidates.length) { tryYouTube(); return; }
      const addon = candidates[i++];
      const base = addon.manifest.base;
      apiAddonSearch(base, q, addon.manifest.defaultQuality || 'LOSSLESS')
        .then((res) => {
          if (token !== transitionToken) return;
          if (res?.found === false || !res?.tracks?.length) { tryNext(); return; }
          const list = res.tracks;
          // Prefer exact title match, then first result.
          const titleLower = String(track.title || '').toLowerCase().trim();
          const match = list.find((t) => String(t.title || '').toLowerCase().trim() === titleLower) || list[0];
          if (!match) { tryNext(); return; }
          const followed = { ...match, isAddon: true, addonBase: base, _triedAddons: [...tried, base] };
          const newQueue = get().queue.slice();
          if (index >= 0 && index < newQueue.length) newQueue[index] = followed;
          set({ queue: newQueue });
          get().toast('Switched addon', `${addon.manifest.name} — "${track.title}"`);
          get()._loadAndPlay(index, newQueue);
        })
        .catch(() => { if (token === transitionToken) tryNext(); });
    };
    tryNext();
  },

  // ---------- audio element events (wired once in App) ----------
  handleTimeUpdate(e) {
    if (e?.target && e.target !== activeAudio()) return;
    const t = activeAudio().currentTime || 0;
    const prev = get().currentTime;
    if (Math.abs(t - prev) >= 0.2 || t === 0) set({ currentTime: t });
    // AB loop: jump back to A once B is reached.
    const ab = get().abLoop;
    if (ab?.a != null && ab?.b != null && ab.b > ab.a && t >= ab.b) {
      get().seekTo(ab.a);
      return;
    }
    // Skip silence: seek forward past long quiet gaps.
    if (get().settings?.skipSilence && get().isPlaying) {
      try {
        const analyser = getAnalyser();
        if (analyser) {
          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const now = Date.now();
          if (rms < 0.012 && t > 5 && t < (get().duration || 0) - 3) {
            silenceSince = silenceSince || now;
            if (now - silenceSince > 2500) {
              silenceSince = null;
              get().seekTo(Math.min((get().duration || 0) - 1, t + 2));
              return;
            }
          } else {
            silenceSince = null;
          }
        }
      } catch { /* analyser unavailable */ }
    }
    get()._checkSkipSegments(t);
    get()._maybeStartFadeOut();
    get()._maybePreloadNext();
  },
  handleDurationChange(e) {
    if (e?.target && e.target !== activeAudio()) return;
    const d = Number.isFinite(activeAudio().duration) ? activeAudio().duration : get().duration;
    if (d) set({ duration: d });
    // Preview detection: some public addons only serve ~30s previews even
    // though search metadata says the full length (e.g. 242s). Warn once
    // per track and offer the YouTube version as a full-length fallback.
    const track = get().currentTrack();
    if (track?.isAddon && track.duration > 0 && d > 0 && d < track.duration * 0.6 && lastPreviewWarnedId !== track.id) {
      lastPreviewWarnedId = track.id;
      get().toast(
        'Addon preview only',
        `"${track.title}" — this addon returned a ~${Math.round(d)}s preview, not the full ${Math.round(track.duration)}s track.`,
        {
          label: 'Play on YouTube',
          onClick: () => {
            const q = `${track.title} ${track.artist || ''}`.trim();
            if (!q) return;
            apiSearch(q)
              .then((res) => {
                const list = res?.results || [];
                const match = list.find((t) => t.kind === 'song') || list[0];
                if (match) get().playTrack(match, list);
                else get().toast('Not found on YouTube', 'No matching track was found.');
              })
              .catch(() => get().toast('Search failed', 'Could not look up the YouTube version.'));
          },
        },
      );
    }
  },
  handleEnded(e) {
    if (e?.target && e.target !== activeAudio()) return;
    const { sleepTimer } = get();
    if (sleepTimer === 'track') {
      get()._stopBothEngines();
      clearFadeTimer();
      activeAudio().volume = get()._targetVolume();
      set({ isPlaying: false, sleepTimer: null, currentTime: 0 });
      get().toast('Sleep timer', 'Good night. Playback stopped.');
      return;
    }
    // Gapless: promote the preloaded element instantly (no reload gap).
    if (get()._promotePreload?.()) return;
    get().next(false);
  },
  handleWaiting(e) {
    if (e?.target && e.target !== activeAudio()) return;
    set({ trackLoading: true });
    get()._noteStall?.();
  },
  handlePlaying(e) {
    if (e?.target && e.target !== activeAudio()) return;
    set({ trackLoading: false, isReady: true, streamError: null });
  },
  handleError(e) {
    // Inactive (preload) element failures are non-fatal.
    if (e?.target && e.target !== activeAudio()) {
      preloaded = null;
      return;
    }
    clearFadeTimer();
    fadingOut = false;
    activeAudio().volume = get()._targetVolume();
    const track = get().currentTrack();
    const engine = get().settings.engine || 'auto';
    // Addon tracks carry Qobuz/Deezer IDs, not YouTube IDs — the embedded
    // YouTube player can never play them. Fail over to the next addon,
    // then to YouTube, instead of showing a dead stream error.
    if (track?.isAddon) {
      const { index } = get();
      get()._failoverTrack(track, index, track._triedAddons || []);
      return;
    }
    if (engine === 'auto' && !get().streamFellBack) {
      set({ streamFellBack: true, trackLoading: false, streamError: null });
      get().toast('Switching audio engine', 'The stream is blocked right now — playing through the embedded player instead.');
      // replay the same track through the embed engine
      const { index, queue } = get();
      get()._loadAndPlay(index, queue);
      return;
    }
    set({ trackLoading: false, isPlaying: false, streamError: `Couldn't load “${track?.title || 'track'}”. The stream may be unavailable.` });
    get().toast('Stream failed', 'The audio source could not be loaded. The provider may be rate-limiting — try again shortly, or switch the Stream source in Settings.');
  },

  // ---------- embed (YouTube IFrame) reporting — called by EmbedEngine ----------
  _setEmbedState(playerState) {
    // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    switch (playerState) {
      case 1:
        set({ isPlaying: true, trackLoading: false, isReady: true, streamError: null });
        break;
      case 2:
        set({ isPlaying: false });
        break;
      case 3:
        set({ trackLoading: true });
        break;
      case 5:
        set({ trackLoading: false });
        break;
      case 0: {
        const { sleepTimer } = get();
        if (sleepTimer === 'track') {
          try { embedBridge.player?.pauseVideo(); } catch { /* noop */ }
          set({ isPlaying: false, sleepTimer: null, currentTime: 0 });
          get().toast('Sleep timer', 'Good night. Playback stopped.');
          return;
        }
        set({ isPlaying: false, currentTime: 0 });
        get().next(false);
        return;
      }
      default:
        break;
    }
  },

  _setEmbedError(code) {
    const messages = {
      2: 'The video id looks invalid.',
      5: 'The embedded player failed — try a different browser.',
      100: 'This video was removed or made private.',
      101: 'The owner of this video disabled embedding.',
      150: 'The owner of this video disabled embedding.',
    };
    const msg = messages[code] || 'The provider refused to play this video.';
    set({ streamError: msg, trackLoading: false, isPlaying: false });
    get().toast('Can’t play this video', msg);
  },

  setEmbedTime(t, d) {
    const patch = {};
    if (Number.isFinite(t)) patch.currentTime = t;
    if (Number.isFinite(d) && d > 0) patch.duration = d;
    if (Object.keys(patch).length) set(patch);
    if (Number.isFinite(t)) get()._checkSkipSegments(t);
  },
}));

// keep module export for other components that need the element
export default usePlayer;
