/**
 * Chordless — UI language (ID/EN). Stage 1 covers the most visible chrome:
 * sidebar, Home headings, Settings titles, PlayerBar, Library headings.
 * `t(lang, key)` falls back to English, then to the key itself.
 */

const DICT = {
  en: {
    'nav.home': 'Home',
    'nav.search': 'Search',
    'nav.library': 'Library',
    'nav.stats': 'Stats',
    'nav.settings': 'Settings',
    'home.greeting.morning': 'Good morning',
    'home.greeting.afternoon': 'Good afternoon',
    'home.greeting.evening': 'Good evening',
    'home.greeting.night': 'Good night',
    'home.pickSomething': 'pick something',
    'home.shortcut.newPlaylist': 'New Playlist',
    'home.shortcut.newFolder': 'New Folder',
    'home.shortcut.likedSongs': 'Liked Songs',
    'home.shortcut.noPlaylists': 'No playlists yet.',
    'home.foryou.kicker': 'AI MIX · FOR YOU',
    'home.foryou.title': 'For You',
    'home.foryou.empty': 'Your personal mix',
    'lib.title': 'Your library',
    'stats.title': 'Your stats',
    'search.placeholder': 'Songs, artists, albums…',
    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.playbackEngine': 'Playback engine',
    'settings.region': 'Region',
    'settings.lossless': 'Lossless addons',
    'settings.equalizer': 'Equalizer',
    'settings.crossfade': 'Crossfade',
    'settings.spatial': 'Spatial audio',
    'player.play': 'Play',
    'player.pause': 'Pause',
    'player.next': 'Next track',
    'player.prev': 'Previous track',
  },
  id: {
    'nav.home': 'Beranda',
    'nav.search': 'Cari',
    'nav.library': 'Lib Perpustakaan',
    'nav.stats': 'Statistik',
    'nav.settings': 'Pengaturan',
    'home.greeting.morning': 'Selamat pagi',
    'home.greeting.afternoon': 'Selamat siang',
    'home.greeting.evening': 'Selamat sore',
    'home.greeting.night': 'Selamat malam',
    'home.pickSomething': 'pilih sesuatu',
    'home.shortcut.newPlaylist': 'Playlist Baru',
    'home.shortcut.newFolder': 'Folder Baru',
    'home.shortcut.likedSongs': 'Lagu Disukai',
    'home.shortcut.noPlaylists': 'Belum ada playlist.',
    'home.foryou.kicker': 'AI MIX · UNTUKMU',
    'home.foryou.title': 'Untukmu',
    'home.foryou.empty': 'Mix pribadimu',
    'lib.title': 'Lib Perpustakaan Kamu',
    'stats.title': 'Statistik Kamu',
    'search.placeholder': 'Lagu, artis, album…',
    'settings.title': 'Pengaturan',
    'settings.appearance': 'Tampilan',
    'settings.playbackEngine': 'Mesin pemutaran',
    'settings.region': 'Wilayah',
    'settings.lossless': 'Addon lossless',
    'settings.equalizer': 'Equalizer',
    'settings.crossfade': 'Crossfade',
    'settings.spatial': 'Audio spasial',
    'player.play': 'Putar',
    'player.pause': 'Jeda',
    'player.next': 'Lagu berikutnya',
    'player.prev': 'Lagu sebelumnya',
  },
};

export function t(lang, key) {
  return DICT[lang]?.[key] || DICT.en[key] || key;
}

export const SUPPORTED_LANGS = [
  { id: 'en', label: 'English' },
  { id: 'id', label: 'Bahasa Indonesia' },
];
