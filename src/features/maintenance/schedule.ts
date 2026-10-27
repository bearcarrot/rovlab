// Full Maintenance Mode: pure window logic + a client store. React-free and dependency-injected so it runs under
// node --experimental-strip-types (tests/maintenance/schedule.test.ts). Same shape as features/announcements/schedule.ts.
//
// Rule: active = enabled && startAt <= now < endAt   (start inclusive, end exclusive). Anything invalid = NOT active (fail-open).

export type MaintenanceConfig = {
  enabled: boolean;
  startsAt: string | null; // ISO instant (timestamptz)
  endsAt: string | null;
  message: string;
  etaNote: string;
};
export type FetchResult = { config: MaintenanceConfig; serverNow: string };

export const MAX_TIMER_MS = 2147483647; // setTimeout silently overflows beyond 2^31-1 ms
export const STALE_MS = 60_000; // becoming visible again refetches only if the last fetch is older than this
export const MAX_AGE_MS = 10 * 60_000; // upper bound on staleness for a tab that stays open and visible
export const JITTER_MIN_MS = 250;
export const JITTER_MAX_MS = 3000;
const EARLY_GUARD_MS = 5; // a timer must never run before the boundary

export function parseWindow(c: MaintenanceConfig | null): { startMs: number; endMs: number } | null {
  if (c === null || !c.enabled || c.startsAt === null || c.endsAt === null) return null;
  const startMs = Date.parse(c.startsAt);
  const endMs = Date.parse(c.endsAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

export function isMaintenanceActive(c: MaintenanceConfig | null, nowMs: number): boolean {
  const w = parseWindow(c);
  return w !== null && w.startMs <= nowMs && nowMs < w.endMs;
}

// The next instant at which the answer can change (start while upcoming, end while active), else null.
export function nextBoundaryMs(c: MaintenanceConfig | null, nowMs: number): number | null {
  const w = parseWindow(c);
  if (w === null) return null;
  if (nowMs < w.startMs) return w.startMs;
  if (nowMs < w.endMs) return w.endMs;
  return null;
}

export type ScheduleState = "disabled" | "invalid" | "upcoming" | "active" | "ended";

// For the admin status line. "invalid" = enabled but the times are missing/unparseable/reversed.
export function scheduleState(c: MaintenanceConfig, nowMs: number): ScheduleState {
  if (!c.enabled) return "disabled";
  const w = parseWindow(c);
  if (w === null) return "invalid";
  if (nowMs < w.startMs) return "upcoming";
  if (nowMs < w.endMs) return "active";
  return "ended";
}

// ---------------- admin form validation (toIso is injected: bangkokLocalToIso, throws on a bad value) ----------------

export type FormValues = { enabled: boolean; startLocal: string; endLocal: string; message: string; etaNote: string };
export type SaveInput = { enabled: boolean; startsAt: string | null; endsAt: string | null; message: string; etaNote: string };
export type FormResult = { ok: true; input: SaveInput } | { ok: false; errors: Partial<Record<keyof FormValues, string>> };

export const MESSAGE_MAX = 1000;
export const ETA_MAX = 200;
const len = (s: string) => [...s].length;

export function validateForm(v: FormValues, toIso: (local: string) => string, nowMs: number): FormResult {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  const message = v.message.trim();
  const etaNote = v.etaNote.trim();
  if (len(message) > MESSAGE_MAX) errors.message = `ข้อความประกาศยาวเกิน ${MESSAGE_MAX} ตัวอักษร`;
  if (len(etaNote) > ETA_MAX) errors.etaNote = `ข้อความเวลาเสร็จยาวเกิน ${ETA_MAX} ตัวอักษร`;

  const parse = (local: string, key: "startLocal" | "endLocal"): string | null => {
    if (local.trim() === "") return null;
    try {
      return toIso(local.trim());
    } catch {
      errors[key] = "วันที่หรือเวลาไม่ถูกต้อง";
      return null;
    }
  };
  const startsAt = parse(v.startLocal, "startLocal");
  const endsAt = parse(v.endLocal, "endLocal");

  if (v.enabled) {
    if (startsAt === null && !errors.startLocal) errors.startLocal = "กรุณาเลือกเวลาเริ่ม";
    if (endsAt === null && !errors.endLocal) errors.endLocal = "กรุณาเลือกเวลาสิ้นสุด";
  }
  if (startsAt !== null && endsAt !== null) {
    if (Date.parse(endsAt) <= Date.parse(startsAt)) errors.endLocal = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
    else if (v.enabled && Date.parse(endsAt) <= nowMs) errors.endLocal = "เวลาสิ้นสุดผ่านไปแล้ว";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { enabled: v.enabled, startsAt, endsAt, message, etaNote } };
}

// ---------------- store ----------------

// Last good answer, kept by the glue (localStorage, short TTL) so a full reload can skip the first request.
export type PersistedMaintenance = { at: number; config: MaintenanceConfig; offsetMs: number };

export type StoreDeps = {
  fetchConfig(): Promise<FetchResult>;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  random(): number;
  onVisible(cb: () => void): () => void;
  onOnline(cb: () => void): () => void;
  persist?: { read(): PersistedMaintenance | null; write(state: PersistedMaintenance): void };
};

export type Snapshot = {
  status: "idle" | "loading" | "ready" | "error";
  config: MaintenanceConfig | null;
  offsetMs: number; // server time minus device time
  active: boolean;
};

export type MaintenanceStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  invalidate(): Promise<void>;
};

export function createMaintenanceStore(deps: StoreDeps): MaintenanceStore {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = { status: "idle", config: null, offsetMs: 0, active: false };
  let status: Snapshot["status"] = "idle";
  let config: MaintenanceConfig | null = null;
  let offsetMs = 0; // a wrong device clock cannot shift the boundaries
  let lastFetchAt: number | null = null; // device time
  let lastAttemptAt: number | null = null;
  let lastFailed = false;
  let timer: unknown = null;
  let generation = 0;
  let inflight: Promise<void> | null = null;
  let unsubVisible: (() => void) | null = null;
  let unsubOnline: (() => void) | null = null;

  const serverNow = () => deps.now() + offsetMs;
  const jitter = () => JITTER_MIN_MS + Math.floor(deps.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1)); // eslint-disable-line

  // Recompute from what is already loaded (no network). Keeps snapshot identity when nothing changed.
  function publish() {
    const next: Snapshot = { status, config, offsetMs, active: isMaintenanceActive(config, serverNow()) };
    if (next.status === snapshot.status && next.config === snapshot.config && next.offsetMs === snapshot.offsetMs && next.active === snapshot.active) return;
    snapshot = next;
    for (const l of [...listeners]) l();
  }

  function clearTimerHandle() {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
  }

  // Exactly one timer, ever: the earlier of "next window boundary" and "max age since the last attempt".
  function arm() {
    clearTimerHandle();
    if (listeners.size === 0) return;
    const boundary = nextBoundaryMs(config, serverNow());
    const toBoundary = boundary === null ? Infinity : Math.max(0, boundary - serverNow()) + EARLY_GUARD_MS;
    const toRecheck = lastAttemptAt === null ? 0 : Math.max(0, lastAttemptAt + MAX_AGE_MS - deps.now());
    // A recheck that would land just before the boundary is merged into the boundary timer, so the flip is never early/late by it.
    const delay = toRecheck < toBoundary - EARLY_GUARD_MS ? toRecheck : toBoundary;
    timer = deps.setTimer(onTimer, Math.min(delay, MAX_TIMER_MS));
  }

  function onTimer() {
    timer = null;
    publish(); // boundary reached: flip immediately from the loaded config (exact, no network)
    timer = deps.setTimer(() => {
      timer = null;
      publish(); // a boundary that fell inside the jitter window still flips locally, without waiting for the network
      void load(false); // then confirm with the server after a small jitter so clients do not stampede; load() re-arms
    }, jitter());
  }

  // Reuse a recent answer saved by a previous page load, but never one that shows maintenance as active: a visitor on the
  // maintenance page must always ask the server, so the end of a window (or an early disable) is seen at once.
  function hydrate(): boolean {
    const saved = deps.persist?.read() ?? null;
    if (saved === null) return false;
    const now = deps.now();
    if (saved.at > now) return false; // clock went backwards: do not trust it
    if (isMaintenanceActive(saved.config, now + saved.offsetMs)) return false;
    offsetMs = saved.offsetMs;
    config = saved.config;
    status = "ready";
    lastFetchAt = now;
    lastAttemptAt = saved.at; // the max-age recheck is measured from the original fetch, not from this reload
    lastFailed = false;
    return true;
  }

  function load(force: boolean): Promise<void> {
    if (inflight !== null && !force) return inflight;
    const gen = ++generation; // a newer request supersedes any older one still in flight
    lastAttemptAt = deps.now();
    if (status === "idle") {
      status = "loading";
      publish();
    }
    let p!: Promise<void>;
    p = (async () => {
      try {
        const r = await deps.fetchConfig();
        if (gen !== generation) return;
        const off = Date.parse(r.serverNow) - deps.now();
        if (Number.isNaN(off)) throw new Error("invalid server time");
        offsetMs = off;
        config = r.config;
        lastFetchAt = deps.now();
        lastFailed = false;
        status = "ready";
        publish();
        arm();
        deps.persist?.write({ at: lastFetchAt, config: r.config, offsetMs: off });
      } catch {
        if (gen !== generation) return;
        lastFailed = true;
        status = "error"; // keep the last known config; with none, the site stays open (fail-open)
        publish();
        arm();
      } finally {
        if (inflight === p) inflight = null;
      }
    })();
    inflight = p;
    return p;
  }

  const isStale = () => lastFetchAt === null || deps.now() - lastFetchAt > STALE_MS;

  function handleVisible() {
    publish(); // background timers may have been throttled: re-evaluate right away
    if (isStale()) void load(false);
    else arm();
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
        const hydrated = status === "idle" && hydrate();
        publish();
        if (!hydrated && (status === "idle" || isStale())) void load(false);
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
