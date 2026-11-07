import { useEffect, useRef } from 'react';
import usePlayer, { getAnalyser } from '../store.js';

/**
 * Real-time spectrum canvas.
 *
 * Two sources of energy:
 *  1. Stream engine — real FFT data from the Web Audio analyser.
 *  2. Embedded player — no analyser access possible, so we synthesize a
 *     convincing spectrum seeded from the track id (tempo + phases), still
 *     fully synchronized to play/pause & playback rate.
 */
export default function Visualizer({ className }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const levelsRef = useRef(new Float32Array(56).fill(0.04));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const n = 56;
    const freq = new Uint8Array(128);
    const accent = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#fc3c44';
    const seedFor = (str) => {
      let h = 2166136261 >>> 0;
      const s = String(str || 'x');
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return (h >>> 0) / 4294967295;
    };

    // per-track synth state, re-seeded when the track changes
    let lastTrackId = null;
    let tempo = 108;
    let barPhase = new Float32Array(n);
    let barSpeed = new Float32Array(n);
    let barDepth = new Float32Array(n);
    let t = 0;
    let idleT = 0;

    const seedTrack = (id) => {
      const r0 = seedFor(id);
      tempo = 92 + r0 * 34; // 92–126 bpm feel
      for (let i = 0; i < n; i++) {
        barPhase[i] = seedFor(`${id}:p:${i}`) * Math.PI * 2;
        barSpeed[i] = 0.65 + seedFor(`${id}:s:${i}`) * 1.15;
        barDepth[i] = 0.35 + seedFor(`${id}:d:${i}`) * 0.65;
      }
      t = 0;
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const state = usePlayer.getState();
      const isPlaying = state.isPlaying;
      const rate = state.playbackRate || 1;
      const trackId = state.currentTrack()?.id ?? null;
      if (trackId !== lastTrackId) {
        lastTrackId = trackId;
        seedTrack(trackId);
      }
      t += 0.016 * rate;

      const levels = levelsRef.current;
      const analyser = getAnalyser();

      // try the real analyser first
      let useReal = false;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freq);
        let max = 0;
        for (let i = 0; i < freq.length; i++) if (freq[i] > max) max = freq[i];
        if (max > 10) {
          useReal = true;
          for (let i = 0; i < n; i++) {
            const pos = Math.pow(i / n, 1.55);
            const bin = Math.floor(pos * (freq.length - 1));
            const target = Math.pow(freq[bin] / 255, 1.35) * 0.9 + 0.05;
            levels[i] += (target - levels[i]) * 0.42;
          }
        }
      }

      if (!useReal) {
        if (isPlaying) {
          // lively synthetic spectrum with a head-ish pulse
          const beat = Math.pow(0.5 + 0.5 * Math.sin(t * ((tempo / 60) * Math.PI * 2) * 0.5), 2.2);
          for (let i = 0; i < n; i++) {
            const p = barPhase[i];
            const speed = barSpeed[i];
            const depth = barDepth[i];
            const wave =
              Math.pow(0.5 + 0.5 * Math.sin(t * 1.9 * speed + p + Math.sin(t * 1.1 + i * 0.35)), 2.6);
            const shimmer = 0.12 * Math.sin(t * 11 + i * 1.7);
            const shape = 0.35 + 0.65 * wave;
            const target = Math.min(0.98, Math.max(0.05, shape * depth * (0.35 + 0.75 * beat) + shimmer + 0.12));
            levels[i] += (target - levels[i]) * 0.28;
          }
        } else {
          idleT += 0.016;
          for (let i = 0; i < n; i++) {
            const wave = 0.055 + 0.05 * (0.5 + 0.5 * Math.sin(idleT * 1.4 + i * 0.34));
            levels[i] += (wave - levels[i]) * 0.06;
          }
        }
      }

      ctx.clearRect(0, 0, width, height);
      const gap = Math.max(2, Math.round(width / (n * 2.6)));
      const barW = Math.max(2, (width - gap * (n - 1)) / n);
      const baseY = height - 2;
      const maxBar = height - 4;
      const col = accent();

      for (let i = 0; i < n; i++) {
        const v = Math.min(1, Math.max(0.02, levels[i]));
        const h = Math.max(3, v * maxBar);
        const x = i * (barW + gap);
        const y = baseY - h;
        const grad = ctx.createLinearGradient(0, y, 0, baseY);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, col);
        grad.addColorStop(1, col);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.55 + v * 0.45;
        const r = Math.min(barW / 2, 3);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barW, h, r);
        else ctx.rect(x, y, barW, h);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
