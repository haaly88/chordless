/**
 * Chordless — lightweight performance telemetry (Web Vitals, client-side).
 * Measures LCP / CLS / INP via PerformanceObserver when available, persists
 * the last sample to `cl:perf`, and surfaces it in Stats → Diagnostics.
 * Best-effort: all APIs are guarded and failures are silently ignored.
 */

export function initPerf() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;
  try {
    const existing = JSON.parse(localStorage.getItem('cl:perf') || 'null');
    const perf = { lcp: null, cls: null, inp: null, updatedAt: Date.now(), samples: existing?.samples || 0 };
    const save = () => {
      try { localStorage.setItem('cl:perf', JSON.stringify(perf)); } catch { /* ignore */ }
    };

    // LCP — largest contentful paint
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          perf.lcp = Math.round(e.startTime);
          perf.updatedAt = Date.now();
          perf.samples += 1;
          save();
        }
      });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* unsupported */ }

    // CLS — cumulative layout shift
    try {
      let cls = 0;
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput) cls += e.value;
          perf.cls = Math.round(cls * 1000) / 1000;
          perf.updatedAt = Date.now();
          save();
        }
      });
      po.observe({ type: 'layout-shift', buffered: true });
    } catch { /* unsupported */ }

    // INP — interaction to next paint
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.interactionId) {
            perf.inp = Math.round(e.duration);
            perf.updatedAt = Date.now();
            save();
          }
        }
      });
      po.observe({ type: 'event', buffered: true, durationThreshold: 40 });
    } catch { /* unsupported */ }
  } catch { /* ignore */ }
}

export function readPerf() {
  try {
    return JSON.parse(localStorage.getItem('cl:perf') || 'null');
  } catch {
    return null;
  }
}
