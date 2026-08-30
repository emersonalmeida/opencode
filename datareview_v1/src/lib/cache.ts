/**
 * localStorage-backed cache with TTL and quota-safe writes.
 * Key namespace: aso:cache:v1
 */

const PREFIX = "aso:cache:v1:";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface Envelope<T> {
  v: T;
  e: number; // expiry timestamp
}

export function makeKey(parts: (string | number | boolean | null | undefined)[]) {
  return parts.map(p => String(p ?? "")).join("|");
}

export function readCache<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env.e !== "number") return undefined;
    if (Date.now() > env.e) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return env.v;
  } catch {
    return undefined;
  }
}

export function writeCache<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS) {
  const env: Envelope<T> = { v: value, e: Date.now() + ttlMs };
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(env));
  } catch {
    // Quota exceeded — evict oldest entries and retry once.
    try {
      const entries: [string, number][] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) || "{}") as Envelope<unknown>;
            entries.push([k, parsed.e || 0]);
          } catch { /* ignore */ }
        }
      }
      entries.sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < Math.max(1, Math.floor(entries.length * 0.3)); i++) {
        localStorage.removeItem(entries[i][0]);
      }
      localStorage.setItem(PREFIX + key, JSON.stringify(env));
    } catch { /* give up silently */ }
  }
}

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttlMs?: number; bypass?: boolean; skipCacheIf?: (v: T) => boolean } = {}
): Promise<T> {
  if (!opts.bypass) {
    const hit = readCache<T>(key);
    if (hit !== undefined) {
      const skipHit = opts.skipCacheIf ? opts.skipCacheIf(hit) : false;
      if (!skipHit) return hit;
    }
  }
  const value = await fetcher();
  const skip = opts.skipCacheIf ? opts.skipCacheIf(value) : false;
  if (!skip) writeCache(key, value, opts.ttlMs);
  return value;
}

export function clearCache(pattern?: string) {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && (!pattern || k.includes(pattern))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
