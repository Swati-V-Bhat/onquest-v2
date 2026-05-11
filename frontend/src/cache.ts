// Simple in-memory TTL cache for read-only API responses.
// Use cacheGet/Set in screens to avoid re-fetching on every tab focus.

type Entry = { data: unknown; expiresAt: number };
const store = new Map<string, Entry>();

export function cacheGet<T = unknown>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return e.data as T;
}

export function cacheSet<T = unknown>(key: string, data: T, ttlSeconds = 60): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheBust(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

// Stale-while-revalidate helper: returns cached if any and fires fetcher.
// fetcher updates cache on success.
export async function swr<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60,
  onUpdate?: (data: T) => void
): Promise<T | null> {
  const cached = cacheGet<T>(key);
  if (cached !== null) {
    // Fire in background, but don't await
    fetcher()
      .then((fresh) => {
        cacheSet(key, fresh, ttlSeconds);
        if (onUpdate) onUpdate(fresh);
      })
      .catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetcher();
    cacheSet(key, fresh, ttlSeconds);
    return fresh;
  } catch {
    return null;
  }
}
