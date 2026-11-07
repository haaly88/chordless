/**
 * Chordless — localStorage helpers (single source of truth for `cl:*` keys).
 * JSON helpers for objects/arrays, plain-string helpers for simple text
 * keys (e.g. Listen Together display name). Includes one-time `bc:*` migration.
 */

export const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full/blocked */ }
};

export const readString = (key, fallback = '') => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

export const writeString = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch { /* full/blocked */ }
};

/** Read `cl:*` key, migrating the legacy `bc:*` key once (keeps user data). */
export const readMigrated = (key, fallback) => {
  const v = read(key, undefined);
  const legacyKey = 'bc:' + key.slice(3);
  const legacy = read(legacyKey, undefined);
  if (v === undefined) {
    if (legacy !== undefined) {
      write(key, legacy);
      try { localStorage.removeItem(legacyKey); } catch { /* ignore */ }
      return legacy;
    }
    return fallback;
  }
  if (legacy !== undefined) {
    if (key === 'cl:history' && Array.isArray(v) && Array.isArray(legacy)) {
      const seen = new Set();
      const merged = [...v, ...legacy].filter((t) => {
        if (!t?.id || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      }).slice(0, 80);
      write(key, merged);
    }
    try { localStorage.removeItem(legacyKey); } catch { /* ignore */ }
  }
  return v;
};
