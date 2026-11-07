/** Formatting helpers. */

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function formatClock(d = new Date()) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function totalDuration(tracks) {
  return (tracks || []).reduce((acc, t) => acc + (t.duration || 0), 0);
}

export function formatTotalDuration(tracks) {
  const secs = totalDuration(tracks);
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

export function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural || singular + 's'}`;
}

/** Short quality badge text, e.g. "24-bit / 192k". Falls back gracefully. */
export function shortQuality(text) {
  if (!text) return 'LOSSLESS';
  const m = /(\d+)\s*-?\s*bit\s*\/?\s*([\d.]+)\s*khz/i.exec(String(text));
  if (m) return `${m[1]}-bit / ${m[2]}k`;
  const up = String(text).toUpperCase();
  if (/HI[-_ ]?RES/.test(up)) return 'HI-RES';
  if (/LOSSLESS/.test(up)) return 'LOSSLESS';
  return String(text).trim();
}
