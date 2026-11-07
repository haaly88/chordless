/**
 * Chordless — SponsorBlock config helpers (pure, client-side).
 * Mirrors the server categories in `server/sponsorblock.js`.
 */

/** SponsorBlock: friendly labels for skipped categories. */
export const SB_LABELS = {
  sponsor: 'Sponsor segment',
  selfpromo: 'Self-promotion',
  interaction: 'Subscribe reminder',
  music_offtopic: 'Non-music section',
  intro: 'Song intro',
  outro: 'Song outro',
  filler: 'Filler',
  preview: 'Preview / recap',
};

export const DEFAULT_SB_CATEGORIES = {
  sponsor: true,
  selfpromo: true,
  interaction: true,
  music_offtopic: true,
  intro: false,
  outro: false,
  filler: false,
  preview: false,
};

/** Active category list from a settings object (empty when disabled). */
export const sbCategories = (s) =>
  (s?.sb?.enabled === false ? [] : Object.entries(s?.sb?.categories || DEFAULT_SB_CATEGORIES)
    .filter(([, on]) => on)
    .map(([name]) => name));
