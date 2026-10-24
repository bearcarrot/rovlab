// Tiny in-memory TTL cache for read-mostly public data (heroes, stats, tier lists, guides, builds).
// - Concurrent callers share one in-flight request.
// - A failed load is never cached; `keep` can also veto caching a "soft failure" result.
// - Admins bypass the cache entirely (see useIsAdmin) so they always see their own edits immediately.
// - Keys listed in PERSISTED_PREFIXES are also kept in localStorage, so a page reload or a new tab does not
//   refetch the same public hero data (each fetch is a Supabase API Gateway log line). Public data only: never add
//   per-user keys here, or the next person on a shared device would see them.
type Entry = { at: number; value: Promise<unknown>; settled?: { v: unknown } };

const store = new Map<string, Entry>();
let bypass = false;

export const CACHE_TTL_MS = 5 * 60 * 1000;

// Only plain-JSON public values: a Map/Set/Date would come back from JSON.parse as a different type, so those services
// cache plain rows/entries and rebuild the Map on read (see tierlist.ts, balance.ts).
const PERSISTED_PREFIXES = [
  "heroes:",
  "hero:",
  "draft-relations",
  "builds:",
  "patch:latest",
  "videos:",
  "tiers:",
  "balance:recent",
  "items:all",
  "runes:all",
];
const PERSIST_TTL_MS = 15 * 60 * 1000;
// bump when the shape of a persisted value changes, so old entries from a previous deploy are ignored
// v2: "patch:latest" went from a code string to a { id, code, releasedAt } object
const PERSIST_KEY = "rovlab:cache:v2:";

const isPersisted = (key: string) => PERSISTED_PREFIXES.some((p) => key.startsWith(p));

function readPersisted<T>(key: string): { at: number; v: T } | undefined {
  try {
    const raw = localStorage.getItem(PERSIST_KEY + key);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as { at: number; v: T };
    if (Date.now() - saved.at < PERSIST_TTL_MS) return saved;
    localStorage.removeItem(PERSIST_KEY + key);
  } catch {
    // storage blocked or entry corrupt: behave as a cache miss
  }
  return undefined;
}

function writePersisted(key: string, v: unknown): void {
  if (v == null) return; // do not pin "not found" for 15 minutes
  try {
    localStorage.setItem(PERSIST_KEY + key, JSON.stringify({ at: Date.now(), v }));
  } catch {
    // quota exceeded or storage blocked: the in-memory cache still works
  }
}

function clearPersisted(prefix: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PERSIST_KEY + prefix)) localStorage.removeItem(k);
    }
  } catch {
    // storage blocked
  }
}

export function setCacheBypass(on: boolean): void {
  bypass = on;
  if (on) {
    store.clear();
    clearPersisted("");
  }
}

export function clearCache(prefix = ""): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  clearPersisted(prefix);
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
  const persist = isPersisted(key);
  if (persist) {
    const saved = readPersisted<T>(key);
    if (saved) {
      const value = Promise.resolve(saved.v);
      store.set(key, { at: saved.at, value, settled: { v: saved.v } });
      return value;
    }
  }
  const value = load();
  const entry: Entry = { at: Date.now(), value };
  store.set(key, entry);
  value.then(
    (v) => {
      if (!keep(v)) {
        if (store.get(key) === entry) store.delete(key);
      } else {
        entry.settled = { v };
        if (persist) writePersisted(key, v);
      }
    },
    () => {
      if (store.get(key) === entry) store.delete(key);
    },
  );
  return value;
}

// Already-loaded value (memory or localStorage), or undefined. Never starts a load and never waits on one in flight,
// so a caller can reuse another page's data when it is there and fall back to its own query when it is not.
export function peek<T>(key: string, ttlMs: number): T | undefined {
  if (bypass) return undefined;
  const hit = store.get(key);
  if (hit) return hit.settled && Date.now() - hit.at < ttlMs ? (hit.settled.v as T) : undefined;
  if (!isPersisted(key)) return undefined;
  const saved = readPersisted<T>(key);
  if (!saved || Date.now() - saved.at >= ttlMs) return undefined;
  store.set(key, { at: saved.at, value: Promise.resolve(saved.v), settled: { v: saved.v } });
  return saved.v;
}
