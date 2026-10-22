import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMaintenanceStore,
  isMaintenanceActive,
  nextBoundaryMs,
  scheduleState,
  validateForm,
  JITTER_MIN_MS,
  MAX_AGE_MS,
  STALE_MS,
  type FetchResult,
  type MaintenanceConfig,
  type StoreDeps,
} from "../../src/features/maintenance/schedule.ts";
import { bangkokLocalToIso } from "../../src/features/announcements/time.ts";

// Run: node --experimental-strip-types --test tests/maintenance/schedule.test.ts  (Node >= 22.6)
// Window under test: 23 Oct 2026, 05:00-06:00 Asia/Bangkok = 22 Oct 2026 22:00Z - 23:00Z.
const START = Date.parse("2026-10-22T22:00:00.000Z");
const END = Date.parse("2026-10-22T23:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const flush = () => new Promise<void>((r) => setImmediate(r));
const cfg = (o: Partial<MaintenanceConfig> = {}): MaintenanceConfig => ({
  enabled: true, startsAt: iso(START), endsAt: iso(END), message: "", etaNote: "", ...o,
});

test("W1 Bangkok 05:00-06:00 maps to the expected UTC instants", () => {
  assert.equal(bangkokLocalToIso("2026-10-23T05:00"), iso(START));
  assert.equal(bangkokLocalToIso("2026-10-23T06:00"), iso(END));
});
test("W2 disabled is never active, even inside the window", () => {
  assert.equal(isMaintenanceActive(cfg({ enabled: false }), START + 1), false);
});
test("W3 before start is normal operation", () => {
  assert.equal(isMaintenanceActive(cfg(), START - 1), false);
});
test("W4 exactly at the start is maintenance (start inclusive)", () => {
  assert.equal(isMaintenanceActive(cfg(), START), true);
});
test("W5 during the window, including 05:59:59.999, is maintenance", () => {
  assert.equal(isMaintenanceActive(cfg(), START + 30 * 60_000), true);
  assert.equal(isMaintenanceActive(cfg(), END - 1), true);
});
test("W6 exactly at the end is normal operation (end exclusive)", () => {
  assert.equal(isMaintenanceActive(cfg(), END), false);
});
test("W7 after the end is normal operation", () => {
  assert.equal(isMaintenanceActive(cfg(), END + 60_000), false);
});
test("W8 invalid or missing schedule is never active (fail-open)", () => {
  assert.equal(isMaintenanceActive(null, START + 1), false);
  assert.equal(isMaintenanceActive(cfg({ startsAt: null }), START + 1), false);
  assert.equal(isMaintenanceActive(cfg({ endsAt: null }), START + 1), false);
  assert.equal(isMaintenanceActive(cfg({ startsAt: "not a date" }), START + 1), false);
  assert.equal(isMaintenanceActive(cfg({ startsAt: iso(END), endsAt: iso(START) }), START + 1), false);
  assert.equal(isMaintenanceActive(cfg({ startsAt: iso(START), endsAt: iso(START) }), START), false);
});
test("W9 nextBoundary: start while upcoming, end while active, null otherwise", () => {
  assert.equal(nextBoundaryMs(cfg(), START - 5), START);
  assert.equal(nextBoundaryMs(cfg(), START), END);
  assert.equal(nextBoundaryMs(cfg(), END), null);
  assert.equal(nextBoundaryMs(cfg({ enabled: false }), START - 5), null);
});
test("W10 scheduleState labels every case", () => {
  assert.equal(scheduleState(cfg({ enabled: false }), START), "disabled");
  assert.equal(scheduleState(cfg({ endsAt: null }), START), "invalid");
  assert.equal(scheduleState(cfg(), START - 1), "upcoming");
  assert.equal(scheduleState(cfg(), START), "active");
  assert.equal(scheduleState(cfg(), END), "ended");
});

const form = (o = {}) => ({ enabled: true, startLocal: "2026-10-23T05:00", endLocal: "2026-10-23T06:00", message: " ปรับปรุง ", etaNote: "", ...o });
const NOW = START - 3_600_000;
test("F1 valid form is converted from Bangkok time and trimmed", () => {
  const r = validateForm(form(), bangkokLocalToIso, NOW);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.input, { enabled: true, startsAt: iso(START), endsAt: iso(END), message: "ปรับปรุง", etaNote: "" });
});
test("F2 end must be after start", () => {
  const r = validateForm(form({ endLocal: "2026-10-23T05:00" }), bangkokLocalToIso, NOW);
  assert.ok(!r.ok && r.errors.endLocal);
});
test("F3 enabled requires both times; disabled does not", () => {
  const a = validateForm(form({ startLocal: "" }), bangkokLocalToIso, NOW);
  assert.ok(!a.ok && a.errors.startLocal);
  const b = validateForm(form({ enabled: false, startLocal: "", endLocal: "" }), bangkokLocalToIso, NOW);
  assert.ok(b.ok);
});
test("F4 impossible dates are rejected (Feb 30)", () => {
  const r = validateForm(form({ startLocal: "2026-02-30T05:00" }), bangkokLocalToIso, NOW);
  assert.ok(!r.ok && r.errors.startLocal);
});
test("F5 enabling a window that already ended is rejected", () => {
  const r = validateForm(form(), bangkokLocalToIso, END + 1);
  assert.ok(!r.ok && r.errors.endLocal);
});
test("F6 message and eta length limits count code points", () => {
  assert.ok(!validateForm(form({ message: "ก".repeat(1001) }), bangkokLocalToIso, NOW).ok);
  assert.ok(validateForm(form({ message: "ก".repeat(1000) }), bangkokLocalToIso, NOW).ok);
  assert.ok(!validateForm(form({ etaNote: "x".repeat(201) }), bangkokLocalToIso, NOW).ok);
});

// ---------------- store ----------------

function setup(initial: MaintenanceConfig, opts: { skewMs?: number; at?: number } = {}) {
  let device = opts.at ?? START - 10 * 60_000;
  const skew = opts.skewMs ?? 0;
  let server: MaintenanceConfig = initial; // what the "database" currently holds
  const timers = new Map<number, { fn: () => void; at: number }>();
  let nextTimer = 1;
  const reg = { visibleCb: null as null | (() => void), onlineCb: null as null | (() => void), offs: 0 };
  const ctl = { calls: 0, fail: false };
  const deps: StoreDeps = {
    fetchConfig: async (): Promise<FetchResult> => {
      ctl.calls++;
      if (ctl.fail) throw new Error("network");
      return { config: { ...server }, serverNow: iso(device + skew) };
    },
    now: () => device,
    setTimer: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, at: device + ms }); return id; },
    clearTimer: (h) => { timers.delete(h as number); },
    random: () => 0,
    onVisible: (cb) => { reg.visibleCb = cb; return () => { reg.offs++; }; },
    onOnline: (cb) => { reg.onlineCb = cb; return () => { reg.offs++; }; },
  };
  const store = createMaintenanceStore(deps);
  async function advance(ms: number) {
    const target = device + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      device = due[1].at;
      due[1].fn();
      await flush();
    }
    device = target;
    await flush();
  }
  return { store, timers, reg, ctl, advance, setServer: (c: MaintenanceConfig) => { server = c; }, setDevice: (ms: number) => { device = ms; }, device: () => device };
}

test("S1 one fetch on first subscribe; before the window nothing is active and one timer targets the start", async () => {
  const e = setup(cfg());
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.ctl.calls, 1);
  assert.equal(e.store.getSnapshot().status, "ready");
  assert.equal(e.store.getSnapshot().active, false);
  assert.equal(e.timers.size, 1);
  assert.equal([...e.timers.values()][0].at, START + 5);
});
test("S2 maintenance turns on at the start and off at the end without any extra request in between", async () => {
  const e = setup(cfg());
  e.store.subscribe(() => {});
  await flush();
  await e.advance(10 * 60_000 + 5); // timer fires at START+5ms
  assert.equal(e.store.getSnapshot().active, true); // flipped locally, before the jittered refetch
  assert.equal(e.ctl.calls, 1);
  await e.advance(JITTER_MIN_MS); // jittered confirmation fetch
  assert.equal(e.ctl.calls, 2);
  assert.equal(e.store.getSnapshot().active, true);
  await e.advance(60 * 60_000); // reaches END
  assert.equal(e.store.getSnapshot().active, false);
});
test("S3 exactly at START the snapshot is active after the store re-evaluates", async () => {
  const e = setup(cfg(), { at: START });
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot().active, true);
});
test("S4 exactly at END the snapshot is not active", async () => {
  const e = setup(cfg(), { at: END });
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot().active, false);
  assert.equal(e.timers.size, 1); // only the max-age recheck remains
  assert.equal([...e.timers.values()][0].at, END + MAX_AGE_MS);
});
test("S5 cache refresh after save: invalidate() refetches and the new schedule applies at once", async () => {
  const e = setup(cfg({ enabled: false }));
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot().active, false);
  e.setServer(cfg({ startsAt: iso(e.device() - 1000), endsAt: iso(e.device() + 60_000) })); // admin saved a window that has begun
  await e.store.invalidate();
  assert.equal(e.store.getSnapshot().active, true);
  assert.equal(e.ctl.calls, 2);
});
test("S6 cache refresh after disable: invalidate() ends an active window immediately", async () => {
  const e = setup(cfg(), { at: START + 60_000 });
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot().active, true);
  e.setServer(cfg({ enabled: false }));
  await e.store.invalidate();
  assert.equal(e.store.getSnapshot().active, false);
});
test("S7 repeated invalidate() never leaves more than one timer", async () => {
  const e = setup(cfg());
  e.store.subscribe(() => {});
  await flush();
  await e.store.invalidate();
  await Promise.all([e.store.invalidate(), e.store.invalidate(), e.store.invalidate()]);
  assert.equal(e.timers.size, 1);
});
test("S8 a wrong device clock does not shift the boundary (server time wins)", async () => {
  const SKEW = -3_600_000; // device is one hour ahead of the server
  // device starts at START-10min, so server now = START-10min+SKEW: the window starts 10 minutes from now in SERVER time
  const e = setup(cfg({ startsAt: iso(START + SKEW), endsAt: iso(END + SKEW) }), { skewMs: SKEW });
  e.store.subscribe(() => {});
  await flush();
  assert.equal([...e.timers.values()][0].at, e.device() + 10 * 60_000 + 5);
  assert.equal(e.store.getSnapshot().offsetMs, SKEW);
});
test("S9 fetch failure with no config is fail-open (not active), then recovers", async () => {
  const e = setup(cfg(), { at: START + 60_000 });
  e.ctl.fail = true;
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot().status, "error");
  assert.equal(e.store.getSnapshot().active, false);
  e.ctl.fail = false;
  await e.store.invalidate();
  assert.equal(e.store.getSnapshot().active, true);
});
test("S10 fetch failure keeps the last known config (an active window stays active)", async () => {
  const e = setup(cfg(), { at: START + 60_000 });
  e.store.subscribe(() => {});
  await flush();
  e.ctl.fail = true;
  await e.store.invalidate();
  assert.equal(e.store.getSnapshot().status, "error");
  assert.equal(e.store.getSnapshot().active, true);
});
test("S11 an open, visible tab rechecks after MAX_AGE_MS even with no boundary (staleness is bounded)", async () => {
  const e = setup(cfg({ enabled: false }));
  e.store.subscribe(() => {});
  await flush();
  const base = e.ctl.calls;
  await e.advance(MAX_AGE_MS + JITTER_MIN_MS);
  assert.equal(e.ctl.calls, base + 1);
});
test("S12 becoming visible: refetch only when stale", async () => {
  const e = setup(cfg());
  e.store.subscribe(() => {});
  await flush();
  const base = e.ctl.calls;
  e.setDevice(e.device() + 5_000);
  e.reg.visibleCb!();
  await flush();
  assert.equal(e.ctl.calls, base);
  e.setDevice(e.device() + STALE_MS + 1);
  e.reg.visibleCb!();
  await flush();
  assert.equal(e.ctl.calls, base + 1);
});
test("S13 coming back online refetches only after a failure", async () => {
  const e = setup(cfg());
  e.store.subscribe(() => {});
  await flush();
  const base = e.ctl.calls;
  e.reg.onlineCb!();
  await flush();
  assert.equal(e.ctl.calls, base);
  e.ctl.fail = true;
  await e.store.invalidate();
  e.ctl.fail = false;
  e.reg.onlineCb!();
  await flush();
  assert.equal(e.store.getSnapshot().status, "ready");
});
test("S14 last unsubscribe clears the timer and listeners; unsubscribe is idempotent", async () => {
  const e = setup(cfg());
  const u1 = e.store.subscribe(() => {});
  const u2 = e.store.subscribe(() => {});
  await flush();
  u1();
  assert.equal(e.timers.size, 1);
  u2();
  u2();
  assert.equal(e.timers.size, 0);
  assert.equal(e.reg.offs, 2);
});
test("S15 snapshot identity is stable while nothing changes", async () => {
  const e = setup(cfg());
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot(), e.store.getSnapshot());
});
