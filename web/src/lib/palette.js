/**
 * Extract a dominant "vibrant" accent color from artwork using a canvas.
 * The image is loaded through the local proxy (/api/cover?url=…) so the
 * canvas is never tainted. Returns { accent, accentSoft, hue } — all CSS-ready.
 */
import { coverProxy } from './api.js';

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
};

const hslToRgb = (h, s, l) => {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
};

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

export function extractPalette(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 72;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Array(36).fill(null).map(() => ({ count: 0, h: 0, s: 0, l: 0 }));
        let total = 0, sumR = 0, sumG = 0, sumB = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          sumR += r; sumG += g; sumB += b; total++;
          const [h, s, l] = rgbToHsl(r, g, b);
          if (s > 0.32 && l > 0.18 && l < 0.85) {
            const bi = Math.floor(h / 10) % 36;
            const bucket = buckets[bi];
            bucket.count++; bucket.h += h; bucket.s += s; bucket.l += l;
          }
        }
        if (!total) return resolve(null);
        const avg = [Math.round(sumR / total), Math.round(sumG / total), Math.round(sumB / total)];

        let best = null, bestScore = 0;
        for (const bkt of buckets) {
          if (bkt.count < total * 0.02) continue;
          const score = bkt.count * (bkt.s / bkt.count) * 1.6;
          if (score > bestScore) { bestScore = score; best = bkt; }
        }
        // single source of truth: hue + chroma from the best bucket (or the average),
        // with a hard chroma floor so the accent never degenerates to gray/white
        let h; let s;
        if (best) {
          h = best.h / best.count;
          s = best.s / best.count;
        } else {
          const [ah, as_] = rgbToHsl(avg[0], avg[1], avg[2]);
          h = ah; s = as_;
        }
        const sat = Math.min(0.9, Math.max(0.42, s * 1.35 + 0.14));
        let accentRgb = hslToRgb(h, sat, 0.48);
        // final safety: dark enough for white glyphs/text on top
        const lum = 0.2126 * accentRgb[0] + 0.7152 * accentRgb[1] + 0.0722 * accentRgb[2];
        if (lum > 165) accentRgb = accentRgb.map((v) => Math.round(v * 0.68));
        else if (lum > 120) accentRgb = accentRgb.map((v) => Math.round(v * 0.82));
        const accent = hex(accentRgb);
        resolve({
          accent,
          accentSoft: `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.16)`,
          avg: hex(avg),
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = coverProxy(imageUrl);
  });
}
