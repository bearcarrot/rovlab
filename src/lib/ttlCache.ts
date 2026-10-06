// Tiny in-memory TTL cache for read-mostly public data (heroes, stats, tier lists, guides, builds).
// - Concurrent callers share one in-flight request.
// - A failed load is never cached; `keep` can also veto caching a "soft failure" result.
// - Admins bypass the cache entirely (see useIsAdmin) so they always see their own edits immediately.
type Entry = { at: number; value: Promise<unknown> };

const store = new Map<string, Entry>();
let bypass = false;

export const CACHE_TTL_MS = 5 * 60 * 1000;

export function setCacheBypass(on: boolean): void {
  bypass = on;
  if (on) store.clear();
}

export function clearCache(prefix = ""): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  keep: (value: T) => boolean = () => true,
): Promise<T> {
  if (bypass) return load();
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  const entry: Entry = { at: Date.now(), value };
  store.set(key, entry);
  value.then(
    (v) => {
      if (!keep(v) && store.get(key) === entry) store.delete(key);
    },
    () => {
      if (store.get(key) === entry) store.delete(key);
    },
  );
  return value;
}
