/**
 * Fallback stream resolution via youtubei.js (InnerTube) — used when
 * yt-dlp is unavailable or fails for a video. youtubei.js handles the
 * signature decipher + n-parameter challenge internally, so the audio
 * URL it returns is directly playable. yt-dlp remains the primary path.
 */
let innertubePromise = null;

async function innertube() {
  if (!innertubePromise) {
    innertubePromise = (async () => {
      const { Innertube } = await import('youtubei.js');
      return Innertube.create();
    })().catch((e) => {
      innertubePromise = null; // allow retry on next call
      throw e;
    });
  }
  return innertubePromise;
}

function extFor(mime) {
  const m = String(mime || '');
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg') || m.includes('opus')) return 'opus';
  return 'm4a';
}

async function urlFromFormat(yt, fmt) {
  if (fmt.url) return fmt.url;
  if (fmt.signature_cipher || fmt.cipher) {
    try {
      const player = yt?.session?.player;
      return player ? await fmt.decipher(player) : await fmt.decipher();
    } catch {
      return null;
    }
  }
  return null;
}

/** Best audio-only URL for a YouTube music video. */
export async function resolveWithYoutubei(id, quality = 'high') {
  const yt = await innertube();
  const q = String(quality || 'high').toLowerCase();
  const ytQuality = q === 'low' ? 'low' : (q === 'medium' ? 'medium' : 'high');

  // Preferred path: one-shot streamingData (decipher handled internally).
  for (const container of ['mp4', 'webm']) {
    try {
      const format = await yt.getStreamingData(id, { type: 'audio', format: container, quality: ytQuality });
      if (format?.url) {
        return { ext: extFor(format.mime_type), url: format.url, client: 'youtubei' };
      }
    } catch {
      // try next container
    }
  }

  // Raw path: parse the player response ourselves (covers clients where
  // the one-shot filter finds nothing).
  const info = await yt.getBasicInfo(id);
  const streaming = info?.streaming_data || info?.player_response?.streamingData;
  const formats = [
    ...(streaming?.formats || []),
    ...(streaming?.adaptive_formats || []),
  ];
  const audio = formats.filter((f) => f.has_audio && !f.has_video);
  if (!audio.length) throw new Error('youtubei: no audio formats returned');

  const byBitrate = [...audio].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const ordered = q === 'low'
    ? [...byBitrate].reverse()
    : (q === 'medium' ? byBitrate : byBitrate);
  for (const fmt of ordered) {
    const url = await urlFromFormat(yt, fmt);
    if (url) return { ext: extFor(fmt.mime_type), url, client: 'youtubei' };
  }
  throw new Error('youtubei: audio formats need a cipher this build cannot resolve');
}
