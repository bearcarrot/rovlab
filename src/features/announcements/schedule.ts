import type { Announcement } from "./types";

// Schedule-driven client store (spec section 6). React-free and dependency-injected so it runs under node --experimental-strip-types.
export const MAX_TIMER_MS = 2147483647; // setTimeout silently overflows beyond 2^31-1 ms
export const STALE_MS = 60_000;
export const JITTER_MIN_MS = 250;
export const JITTER_MAX_MS = 3000;

// Last good answer, kept by the glue (localStorage, short TTL) so a full reload can skip the first two requests.
export type PersistedAnnouncements = { at: number; items: Announcement[]; offsetMs: number; nextChangeMs: number | null };

export type StoreDeps = {
  fetchItems(): Promise<Announcement[]>;
  fetchSchedule(): Promise<{ serverNow: string; nextChange: string | null }>;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  random(): number;
  onVisible(cb: () => void): () => void;
  onOnline(cb: () => void): () => void;
  persist?: { read(): PersistedAnnouncements | null; write(state: PersistedAnnouncements): void };
};

export type Snapshot = { status: "idle" | "loading" | "ready" | "error"; items: Announcement[]; nowMs: number };

export type AnnouncementStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  invalidate(): Promise<void>;
};

export function createAnnouncementStore(deps: StoreDeps): AnnouncementStore {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = { status: "idle", items: [], nowMs: deps.now() };
  let offsetMs = 0; // server time minus device time, so a wrong device clock cannot shift the boundaries
  let nextChangeMs: number | null = null; // in server time
  let lastFetchAt: number | null = null; // device time
  let lastFailed = false;
  let timer: unknown = null;
  let generation = 0;
  let inflight: Promise<void> | null = null;
  let unsubVisible: (() => void) | null = null;
  let unsubOnline: (() => void) | null = null;

  const serverNow = () => deps.now() + offsetMs;

  function setSnapshot(next: Snapshot) {
    if (next.status === snapshot.status && next.items === snapshot.items && next.nowMs === snapshot.nowMs) return; // keep identity
    snapshot = next;
    for (const l of [...listeners]) l();
  }

  function clearTimerHandle() {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
  }

  function arm() {
    clearTimerHandle(); // exactly one timer, ever
    if (listeners.size === 0 || nextChangeMs === null) return;
    const jitter = JITTER_MIN_MS + Math.floor(deps.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1)); // never early
    const delay = Math.max(0, nextChangeMs - serverNow()) + jitter;
    timer = deps.setTimer(onTimer, Math.min(delay, MAX_TIMER_MS));
  }

  function onTimer() {
    timer = null;
    setSnapshot({ ...snapshot, nowMs: serverNow() }); // re-filter what is already loaded right away
    void load(false); // then ask the server (authoritative; also re-arms, which handles the capped-timer case)
  }

  // Reuse a recent answer saved by a previous page load, unless the next scheduled change has already passed.
  function hydrate(): boolean {
    const saved = deps.persist?.read() ?? null;
    if (saved === null) return false;
    const now = deps.now();
    if (saved.at > now) return false; // clock went backwards: do not trust it
    if (saved.nextChangeMs !== null && now + saved.offsetMs >= saved.nextChangeMs) return false;
    offsetMs = saved.offsetMs;
    nextChangeMs = saved.nextChangeMs;
    lastFetchAt = now;
    lastFailed = false;
    setSnapshot({ status: "ready", items: saved.items, nowMs: serverNow() });
    return true;
  }

  function load(force: boolean): Promise<void> {
    if (inflight !== null && !force) return inflight;
    const gen = ++generation; // a newer request supersedes any older one still in flight
    if (snapshot.status === "idle") setSnapshot({ ...snapshot, status: "loading" });
    let p!: Promise<void>; // assigned right below; the IIFE's finally block compares against it
    p = (async () => {
      try {
        const [items, schedule] = await Promise.all([deps.fetchItems(), deps.fetchSchedule()]);
        if (gen !== generation) return; // stale response
        offsetMs = Date.parse(schedule.serverNow) - deps.now();
        nextChangeMs = schedule.nextChange === null ? null : Date.parse(schedule.nextChange);
        lastFetchAt = deps.now();
        lastFailed = false;
        setSnapshot({ status: "ready", items, nowMs: serverNow() });
        arm();
        deps.persist?.write({ at: lastFetchAt, items, offsetMs, nextChangeMs });
      } catch {
        if (gen !== generation) return;
        lastFailed = true;
        setSnapshot({ status: "error", items: snapshot.items, nowMs: serverNow() }); // keep what we had
      } finally {
        if (inflight === p) inflight = null;
      }
    })();
    inflight = p;
    return p;
  }

  function handleVisible() {
    const now = serverNow();
    setSnapshot({ ...snapshot, nowMs: now });
    const stale = lastFetchAt === null || deps.now() - lastFetchAt > STALE_MS;
    const passed = nextChangeMs !== null && now >= nextChangeMs;
    if (stale || passed) void load(false);
    else arm(); // background timers may have been throttled
  }

  function handleOnline() {
    if (lastFailed) void load(false);
  }

  return {
    subscribe(listener) {
      const wasEmpty = listeners.size === 0;
      listeners.add(listener);
      if (wasEmpty) {
        unsubVisible = deps.onVisible(handleVisible);
        unsubOnline = deps.onOnline(handleOnline);
        const hydrated = snapshot.status === "idle" && hydrate();
        const stale = lastFetchAt === null || deps.now() - lastFetchAt > STALE_MS;
        if (!hydrated && (snapshot.status === "idle" || stale)) void load(false);
        else arm();
      }
      return () => {
        if (!listeners.delete(listener)) return; // idempotent
        if (listeners.size === 0) {
          clearTimerHandle();
          unsubVisible?.();
          unsubOnline?.();
          unsubVisible = null;
          unsubOnline = null;
        }
      };
    },
    getSnapshot: () => snapshot,
    invalidate: () => load(true),
  };
}
