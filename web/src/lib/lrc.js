/** LRC parsing + synced-lyric helpers. */

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** Parse raw LRC text into sorted [{ time, text }] (seconds). */
export function parseLrc(lrc) {
  if (!lrc) return [];
  const lines = [];
  for (const raw of String(lrc).split(/\r?\n/)) {
    // global offset tag, e.g. [offset:+500]
    const offsetMatch = /^\s*\[offset:\s*([+-]?\d+)\s*\]/i.exec(raw);
    if (offsetMatch) continue; // handled globally by the caller if needed

    let match;
    const times = [];
    TIME_TAG.lastIndex = 0;
    while ((match = TIME_TAG.exec(raw)) !== null) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const frac = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) / 1000 : 0;
      times.push(min * 60 + sec + frac);
    }
    if (!times.length) continue;
    const text = raw.replace(TIME_TAG, '').trim();
    for (const time of times) lines.push({ time, text });
  }
  lines.sort((a, b) => a.time - b.time);
  // collapse identical consecutive timestamps
  return lines.filter((l, i) => i === 0 || l.time !== lines[i - 1].time || l.text !== lines[i - 1].text);
}

/** Index of the line that should be active at time t (or -1). */
export function activeLineIndex(lines, t) {
  if (!lines.length) return -1;
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
