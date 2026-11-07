/**
 * Chordless — lightweight genre detection from track title/artist keywords.
 * Keyword-based (no ML); returns a canonical genre key or 'other'.
 */

const RULES = [
  ['k-pop', ['k-pop', 'kpop', 'bts', 'blackpink', 'twice', 'stray kids', 'seventeen', 'aespa', 'ive', 'newjeans', 'le sserafim']],
  ['hip-hop', ['hip hop', 'hip-hop', 'rap', 'trap', 'drake', 'kendrick', 'eminem', 'lil ', 'travis scott', 'yeat', 'playboi', 'central cee']],
  ['edm', ['edm', 'house', 'techno', 'trance', 'dubstep', 'skrillex', 'avicii', 'calvin harris', 'martin garrix', 'tiësto', 'alan walker']],
  ['lo-fi', ['lofi', 'lo-fi', 'chillhop', 'chill beats']],
  ['jazz', ['jazz', 'bossa', 'swing', 'trumpet', 'saxophone']],
  ['rock', ['rock', 'metal', 'punk', 'guitar', 'band', 'metallica', 'nirvana', 'ac/dc', 'queen', 'linkin park']],
  ['r&b', ['r&b', 'rnb', 'soul', 'beyoncé', 'beyonce', 'the weeknd', 'frank ocean']],
  ['reggae', ['reggae', 'dancehall', 'bob marley']],
  ['latin', ['reggaeton', 'perreo', 'bad bunny', 'karol g', 'j balvin', 'shakira', ' Daddy yankee'.toLowerCase(), 'daddy yankee', 'ozuna', 'rauw alejandro']],
  ['dangdut', ['dangdut', 'koplo', 'via vallen', 'happy asmara', 'denny caknan', 'wandra']],
  ['pop', ['pop', 'hits', 'taylor swift', 'dua lipa', 'ed sheeran', 'bruno mars', 'olivia rodrigo', 'ariane grande', 'billie eilish']],
];

export function detectGenre(track) {
  const hay = `${track?.title || ''} ${track?.artist || ''}`.toLowerCase();
  for (const [genre, keys] of RULES) {
    if (keys.some((k) => hay.includes(k))) return genre;
  }
  return 'other';
}

export const GENRE_LABELS = {
  pop: 'Pop',
  'hip-hop': 'Hip-Hop',
  rock: 'Rock',
  'k-pop': 'K-Pop',
  edm: 'EDM',
  'lo-fi': 'Lo-Fi',
  jazz: 'Jazz',
  'r&b': 'R&B',
  reggae: 'Reggae',
  latin: 'Latin',
  dangdut: 'Dangdut',
  other: 'Other',
};
