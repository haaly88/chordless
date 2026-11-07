import { useEffect, useRef } from 'react';
import usePlayer, { embedBridge } from '../store.js';

/**
 * Hidden YouTube IFrame player — the always-sanctioned path for YouTube
 * audio. Used when the engine is set to "YouTube player", or automatically
 * in "Auto" mode when the streaming proxy is blocked/throttled.
 * The video is technically loaded (YouTube serves what it serves) but the
 * user never sees it: 320×180, off-screen, opacity 0, keyboard/mouse inert.
 */
export default function EmbedEngine() {
  const readyRef = useRef(false);

  // boot the IFrame API once
  useEffect(() => {
    let cancelled = false;

    const createPlayer = () => {
      if (cancelled || !window.YT?.Player || embedBridge.player) return;
      // eslint-disable-next-line no-new
      embedBridge.player = new window.YT.Player('embed-engine-frame', {
        width: 320,
        height: 180,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady() {
            embedBridge.ready = true;
            readyRef.current = true;
            if (embedBridge.pendingId) {
              try { embedBridge.player.loadVideoById(embedBridge.pendingId); } catch { /* will retry on next play */ }
              if (embedBridge.wantsPlay) {
                try { embedBridge.player.playVideo(); } catch { /* autoplay may be blocked */ }
              }
            }
            embedBridge.wantsPlay = false;
          },
          onStateChange(e) {
            usePlayer.getState()._setEmbedState(e.data);
          },
          onError(e) {
            usePlayer.getState()._setEmbedError(e.data);
          },
          onAutoplayBlocked() {
            embedBridge.wantsPlay = false;
            usePlayer.setState({ isPlaying: false, trackLoading: false });
            usePlayer.getState().toast('Press play', 'Your browser blocked autoplay — tap the play button.');
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); createPlayer(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
    }
    return () => { cancelled = true; };
  }, []);

  // poll currentTime/duration while the embed engine is active
  useEffect(() => {
    const id = setInterval(() => {
      const state = usePlayer.getState();
      const embed =
        state.settings.engine === 'embed' ||
        (state.settings.engine === 'auto' && state.streamFellBack);
      if (!embed || !embedBridge.ready || !embedBridge.player) return;
      try {
        const t = embedBridge.player.getCurrentTime?.();
        const d = embedBridge.player.getDuration?.();
        if (typeof t === 'number' && Number.isFinite(t)) {
          state.setEmbedTime(t, typeof d === 'number' && Number.isFinite(d) ? d : undefined);
        }
      } catch { /* player mid-transition */ }
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="embed-engine" aria-hidden="true">
      <div id="embed-engine-frame" />
    </div>
  );
}
