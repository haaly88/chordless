/** Tiny in-memory TTL cache with max-size eviction. */
export function createCache({ max = 500, ttlMs = 5 * 60 * 1000 } = {}) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (Date.now() > hit.exp) { map.delete(key); return undefined; }
      // refresh recency
      map.delete(key); map.set(key, hit);
      return hit.value;
    },
    delete(key) { map.delete(key); },
    set(key, value, ttl = ttlMs) {
      if (map.size >= max) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
      map.set(key, { value, exp: Date.now() + ttl });
    },
    clear() { map.clear(); },
  };
}
