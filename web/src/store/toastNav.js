/**
 * Chordless — store slice: toasts + navigation + search focus.
 * State fields themselves stay in `store.js`; this slice only provides
 * behaviour helpers sharing the same `set`/`get`.
 */
import { uid } from '../lib/shuffle.js';
import { translateToastTitle, translateToastSub } from '../lib/i18n.js';

export function createToastNavSlice(set, get) {
  return {
    toast(title, sub, action) {
      const id = uid();
      const lang = get().settings?.lang || 'en';
      const localized = translateToastTitle(lang, title);
      const localizedSub = translateToastSub(lang, sub);
      set((s) => ({ toasts: [...s.toasts.slice(-2), { id, title: localized, sub: localizedSub, action }] }));
      setTimeout(() => get().dismissToast(id), action ? 5200 : 4200);
    },
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
    setView(view) { set({ view }); },
    toggleNowPlaying(open) {
      set((s) => ({ nowPlayingOpen: open ?? !s.nowPlayingOpen }));
    },
    toggleQueue(open) {
      set((s) => ({ queueOpen: open ?? !s.queueOpen }));
    },
    toggleLyrics(open) {
      set((s) => ({ lyricsOpen: open ?? !s.lyricsOpen }));
    },
    toggleKaraoke(open) {
      set((s) => ({ karaokeOpen: open ?? !s.karaokeOpen }));
    },
    setKaraokeFontSize(sz) {
      set({ karaokeFontSize: ['normal', 'large', 'xl'].includes(sz) ? sz : 'large' });
    },
    toggleTogether(open) {
      set((s) => ({ togetherOpen: open ?? !s.togetherOpen }));
    },
    setLyricsOffset(v) { set({ lyricsOffset: Math.max(-10, Math.min(10, v)) }); },
    setSettingsOpen(open) { set({ settingsOpen: open }); },
    setShortcutsOpen(open) { set({ shortcutsOpen: open }); },
    openMenu(menu) { set({ menu }); },
    closeMenu() { if (get().menu) set({ menu: null }); },
    requestSearchFocus() { set((s) => ({ searchFocusTick: s.searchFocusTick + 1 })); },
    setSearchQuery(searchQuery) { set({ searchQuery }); },
    searchFor(term) {
      set({ view: { name: 'search' }, searchQuery: String(term || ''), searchFocusTick: get().searchFocusTick + 1 });
    },
  };
}
