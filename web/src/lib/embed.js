/**
 * Chordless — YouTube IFrame (embed engine) bridge (pure holder).
 * Filled in by the EmbedEngine component as the YouTube IFrame API boots.
 * The store re-exports this so `import { embedBridge } from './store.js'`
 * keeps working.
 */
export const embedBridge = {
  player: null,     // YT.Player instance
  ready: false,     // player is onReady
  pendingId: null,  // video to cue once ready
  wantsPlay: false, // the user pressed play while the API was still loading
};

export function isEmbedEngine(state) {
  const engine = state?.settings?.engine || 'auto';
  return engine === 'embed' || (engine === 'auto' && state?.streamFellBack === true);
}
