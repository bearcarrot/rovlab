// Device-level dismissal cache + sign-in reconciliation (spec section 7). No runtime imports.
// Deliberately has NO remove/clear/prune/reset: IDs are never deleted because an announcement is absent from a response,
// and there is no dismissal-reset feature. Only the hard cap evicts (oldest first).
export type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };
export type DismissResult = { local: "ok" | "failed"; server: "ok" | "failed" | "skipped" };
export type DismissalStore = {
  ids(): Set<string>;
  has(id: string): boolean;
  add(id: string): "ok" | "failed";
  mirror(ids: Iterable<string>): void;
  pending(): string[];
  addPending(id: string): void;
  clearPending(ids: string[]): void;
};

const KEY = "rovlab:announcements:dismissed:v1";
const CAP = 1000;
const CHUNK = 200; // dismiss_announcements() rejects more than 200 ids per call

type State = { ids: Record<string, string>; pending: string[] };

function parse(raw: string | null): State | null {
  if (raw === null) return null;
  try {
    const p = JSON.parse(raw);
    if (p === null || typeof p !== "object" || p.v !== 1 || p.ids === null || typeof p.ids !== "object") return null;
    const ids: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.ids)) if (typeof v === "string") ids[k] = v;
    const pending = Array.isArray(p.pending) ? p.pending.filter((x: unknown): x is string => typeof x === "string") : [];
    return { ids, pending };
  } catch {
    return null; // corrupt JSON: ignored, rewritten on the next save
  }
}

export function createDismissalStore(storage: StorageLike | null, now: () => number = Date.now): DismissalStore {
  let mem: State = { ids: {}, pending: [] }; // what this page has dismissed; survives unavailable/throwing storage

  function load(): State {
    let fromStorage: State | null = null;
    if (storage !== null) {
      try { fromStorage = parse(storage.getItem(KEY)); } catch { fromStorage = null; }
    }
    // Re-read before every write so another tab's dismissals are not clobbered; union with what this page already holds.
    const ids = { ...mem.ids, ...(fromStorage?.ids ?? {}) };
    const pending = [...new Set([...mem.pending, ...(fromStorage?.pending ?? [])])];
    return { ids, pending };
  }

  function save(s: State): "ok" | "failed" {
    const keys = Object.keys(s.ids);
    if (keys.length > CAP) {
      const oldestFirst = keys.sort((x, y) => Date.parse(s.ids[x]) - Date.parse(s.ids[y]));
      for (const k of oldestFirst.slice(0, keys.length - CAP)) delete s.ids[k];
    }
    mem = { ids: { ...s.ids }, pending: [...s.pending] };
    if (storage === null) return "failed";
    try {
      storage.setItem(KEY, JSON.stringify({ v: 1, ids: s.ids, pending: s.pending }));
      return "ok";
    } catch {
      return "failed";
    }
  }

  return {
    ids: () => new Set(Object.keys(load().ids)),
    has: (id) => id in load().ids,
    add(id) {
      const s = load();
      if (!(id in s.ids)) s.ids[id] = new Date(now()).toISOString();
      return save(s);
    },
    mirror(ids) {
      const s = load();
      for (const id of ids) if (!(id in s.ids)) s.ids[id] = new Date(now()).toISOString();
      save(s);
    },
    pending: () => load().pending,
    addPending(id) {
      const s = load();
      if (!s.pending.includes(id)) s.pending.push(id);
      save(s);
    },
    clearPending(ids) {
      const s = load();
      const drop = new Set(ids);
      s.pending = s.pending.filter((x) => !drop.has(x));
      save(s);
    },
  };
}

export async function dismissAnnouncement(
  id: string,
  deps: { store: DismissalStore; signedIn: boolean; push: (ids: string[]) => Promise<void> },
): Promise<DismissResult> {
  const local = deps.store.add(id); // hide immediately; local result is reported as-is
  if (!deps.signedIn) return { local, server: "skipped" };
  try {
    await deps.push([id]);
    return { local, server: "ok" };
  } catch {
    deps.store.addPending(id); // never report server persistence we did not get; retry on next load/sign-in/online
    return { local, server: "failed" };
  }
}

export async function syncOnSignIn(deps: {
  store: DismissalStore;
  fetchServerIds: () => Promise<string[]>;
  push: (ids: string[]) => Promise<void>;
}): Promise<Set<string>> {
  const { store } = deps;
  let server: Set<string>;
  try {
    server = new Set(await deps.fetchServerIds());
  } catch {
    return store.ids(); // server unreachable: nothing to reconcile, keep hiding what the device knows
  }
  const pendingBefore = store.pending();
  const toPush = [...new Set([...store.ids(), ...pendingBefore])].filter((id) => !server.has(id));
  for (let i = 0; i < toPush.length; i += CHUNK) {
    const chunk = toPush.slice(i, i + CHUNK);
    try {
      await deps.push(chunk);
      store.clearPending(chunk);
    } catch {
      for (const id of chunk) store.addPending(id);
    }
  }
  store.mirror(server);
  store.clearPending(pendingBefore.filter((id) => server.has(id)));
  return store.ids();
}
