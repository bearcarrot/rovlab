// Tiny in-memory TTL cache for read-mostly public data (heroes, stats, tier lists, guides, builds).
// - Concurrent callers share one in-flight request.
// - A failed load is never cached; `keep` can also veto caching a "soft failure" result.
// - Admins bypass the cache entirely (see useIsAdmin) so they always see their own edits immediately. Bypass still
//   shares requests that are in flight at the same moment (never reuses a finished one), so N components asking for
//   the same key at once cost one request, not N.
// - Keys listed in PERSISTED_PREFIXES are also kept in localStorage, so a page reload or a new tab does not
//   refetch the same public hero data (each fetch is a Supabase API Gateway log line). Public data only: never add
//   per-user keys here, or the next person on a shared device would see them.
type Entry = { at: number; value: Promise<unknown>; settled?: { v: unknown } };

const store = new Map<string, Entry>();
const bypassInflight = new Map<string, Promise<unknown>>();
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
  "catalog:", // items / runes / spells / enchantments (public game data; see services/gameCatalog.ts)
  "guide", // "guides" (list), "guide-categories" and "guide:<slug>" (see services/guides.ts). The list carries every guide's full text, so it is the heaviest public payload to refetch on each reload
];
const PERSIST_TTL_MS = 15 * 60 * 1000;
// The two heaviest public payloads (hero list ~39 KB, draft relations ~166 KB) change only when an admin imports stats or
// edits relations, yet each visitor refetched them about 3 times a day. They stay in localStorage for 6 hours instead.
// Admins bypass the cache, so their own edits still show at once; visitors see a change within 6 hours.
// index.html (the early prefetch) hardcodes the same 6 h for "heroes:<rank>": keep the two in step.
const LONG_PERSISTED_PREFIXES = ["heroes:", "draft-relations"];
const LONG_PERSIST_TTL_MS = 6 * 60 * 60 * 1000;
// bump when the shape of a persisted value changes, so old entries from a previous deploy are ignored
// v2: "patch:latest" went from a code string to a { id, code, releasedAt } object
const PERSIST_KEY = "rovlab:cache:v2:";

const isPersisted = (key: string) => PERSISTED_PREFIXES.some((p) => key.startsWith(p));
const persistTtl = (key: string) => (LONG_PERSISTED_PREFIXES.some((p) => key.startsWith(p)) ? LONG_PERSIST_TTL_MS : PERSIST_TTL_MS);

function readPersisted<T>(key: string): { at: number; v: T } | undefined {
  try {
    const raw = localStorage.getItem(PERSIST_KEY + key);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as { at: number; v: T };
    if (Date.now() - saved.at < persistTtl(key)) return saved;
    localStorage.removeItem(PERSIST_KEY + key);
  } catch {
    // storage blocked or entry corrupt: behave as a cache miss
  }
  return undefined;
}

function writePersisted(key: string, v: unknown): void {
  if (v == null) return; // do not pin "not found" in storage
  try {
    localStorage.setItem(PERSIST_KEY + key, JSON.stringify({ at: Date.now(), v }));
  } catch {
    // quota exceeded or storage blocked: the in-memory cache still works
  }
}

// Clears every persisted entry whose key starts with `prefix`, including the "site:" entries of lib/sitePersist.ts
// (same namespace), so an admin never keeps a stale or draft-bearing copy.
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

export function isCacheBypassed(): boolean {
  return bypass;
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
  if (bypass) {
    const running = bypassInflight.get(key);
    if (running) return running as Promise<T>;
    const p = load();
    bypassInflight.set(key, p);
    const done = () => {
      if (bypassInflight.get(key) === p) bypassInflight.delete(key);
    };
    p.then(done, done);
    return p;
  }
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
// For persisted keys the age limit is at least the key's persistence TTL, the same rule cached() applies, so Hero Detail
// reuses a hero list or draft relations that cached() would still hand out instead of running its own queries.
export function peek<T>(key: string, ttlMs: number): T | undefined {
  if (bypass) return undefined;
  const persist = isPersisted(key);
  const ttl = persist ? Math.max(ttlMs, persistTtl(key)) : ttlMs;
  const hit = store.get(key);
  if (hit) return hit.settled && Date.now() - hit.at < ttl ? (hit.settled.v as T) : undefined;
  if (!persist) return undefined;
  const saved = readPersisted<T>(key);
  if (!saved || Date.now() - saved.at >= ttl) return undefined;
  store.set(key, { at: saved.at, value: Promise.resolve(saved.v), settled: { v: saved.v } });
  return saved.v;
}
