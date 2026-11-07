/**
 * Client-side mirror of the server's thumbnail upgrader — rewrites the tiny
 * size suffixes our feeds carry (=w120-h120 / =s192) to high-res ones, so
 * artwork stays sharp even when it comes from persisted localStorage data.
 */
export function upgradeThumb(u) {
  if (!u || typeof u !== 'string') return u;
  return u
    .replace(/=w\d{2,4}-h\d{2,4}(-\w[\w-]*)?/g, '=w512-h512$1')
    .replace(/=s\d{2,4}(-\w[\w-]*)?/g, '=s1200$1');
}

export function upgradeTracks(tracks) {
  if (!Array.isArray(tracks)) return tracks;
  return tracks.map((t) => (t ? { ...t, thumbnail: upgradeThumb(t.thumbnail) } : t));
}
