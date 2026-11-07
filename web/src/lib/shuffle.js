/**
 * Chordless — shuffle / id helpers (pure).
 */

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const shuffled = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const sameTrack = (a, b) => a?.id === b?.id;

/** Fisher-Yates shuffle that avoids placing the same artist back-to-back when possible. */
export const smartShuffle = (arr, avoidArtist) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (avoidArtist) {
    for (let i = 1; i < a.length; i++) {
      if (a[i].artist === a[i - 1].artist) {
        for (let j = i + 1; j < a.length; j++) {
          if (a[j].artist !== a[i].artist) {
            [a[i], a[j]] = [a[j], a[i]];
            break;
          }
        }
      }
    }
  }
  return a;
};
