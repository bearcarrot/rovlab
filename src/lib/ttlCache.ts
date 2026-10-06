// Tiny in-memory TTL cache for read-mostly public data (heroes, stats, tier lists).
// - Concurrent callers share one in-flight request.
// - A failed load is never cached.
// - Admins bypass the cache entirely (see useIsAdmin) so they always see their own edits immediately.
type Entry = { at: number; value: Promise<unknown> };

const store = new Map<string, Entry>();
let bypass = false;

export function setCacheBypass(on: boolean): void {
  bypass = on;
  if (on) store.clear();
}

export function clearCache(prefix = ""): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  if (bypass) return load();
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  const entry: Entry = { at: Date.now(), value };
  store.set(key, entry);
  value.catch(() => {
    if (store.get(key) === entry) store.delete(key);
  });
  return value;
}
