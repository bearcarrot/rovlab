import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnnouncementStore, MAX_TIMER_MS, STALE_MS, JITTER_MIN_MS, JITTER_MAX_MS, type StoreDeps } from "../../src/features/announcements/schedule.ts";
import { isVisible } from "../../src/features/announcements/visibility.ts";
import type { Announcement } from "../../src/features/announcements/types.ts";

// Run: node --experimental-strip-types --test tests/announcements/schedule.test.ts  (Node >= 22.6)
// Everything is deterministic: a fake device clock, a manual timer queue, and a fake server that applies the same window rules as RLS.
const START = Date.parse("2026-10-17T05:00:00.000Z");
const none = new Set<string>();
const flush = () => new Promise<void>((r) => setImmediate(r));
const iso = (ms: number) => new Date(ms).toISOString();
const row = (id: string, o: Partial<Announcement> = {}): Announcement => ({
  id, title: id, content: "", media_type: "none", media_url: null, link_url: null, link_label: null, status: "published",
  priority: "normal", is_dismissible: true, starts_at: null, ends_at: null, created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-01T00:00:00.000Z", ...o,
});

function setup(rows: Announcement[], opts: { skewMs?: number; random?: number } = {}) {
  let device = START;
  const skew = opts.skewMs ?? 0; // server time = device time + skew
  const server = () => device + skew;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let nextTimer = 1;
  const reg = { visible: { on: 0, off: 0 }, online: { on: 0, off: 0 }, visibleCb: null as null | (() => void), onlineCb: null as null | (() => void) };
  const ctl = { itemsCalls: 0, scheduleCalls: 0, fail: false, hold: null as null | Promise<void> };
  const active = (r: Announcement) => r.status === "published" && (r.starts_at === null || Date.parse(r.starts_at) <= server()) && (r.ends_at === null || Date.parse(r.ends_at) > server());
  const deps: StoreDeps = {
    fetchItems: async () => {
      ctl.itemsCalls++;
      if (ctl.fail) throw new Error("network");
      const result = rows.filter(active); // evaluated at call time, like a real request that was already answered by the server
      if (ctl.hold) await ctl.hold;
      return result;
    },
    fetchSchedule: async () => {
      ctl.scheduleCalls++;
      if (ctl.fail) throw new Error("network");
      const future: number[] = [];
      for (const r of rows) {
        if (r.status !== "published") continue;
        if (r.starts_at !== null && Date.parse(r.starts_at) > server()) future.push(Date.parse(r.starts_at));
        if (active(r) && r.ends_at !== null) future.push(Date.parse(r.ends_at));
      }
      return { serverNow: iso(server()), nextChange: future.length ? iso(Math.min(...future)) : null };
    },
    now: () => device,
    setTimer: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, at: device + ms }); return id; },
    clearTimer: (h) => { timers.delete(h as number); },
    random: () => opts.random ?? 0,
    onVisible: (cb) => { reg.visible.on++; reg.visibleCb = cb; return () => { reg.visible.off++; }; },
    onOnline: (cb) => { reg.online.on++; reg.onlineCb = cb; return () => { reg.online.off++; }; },
  };
  const store = createAnnouncementStore(deps);
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
  return { store, timers, reg, ctl, advance, setDevice: (ms: number) => { device = ms; }, device: () => device, server };
}

test("S1 a scheduled announcement activates while the app stays open (no navigation, no manual refresh)", async () => {
  const e = setup([row("R", { starts_at: iso(START + 60_000) })]);
  assert.equal(e.store.getSnapshot().status, "idle");
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot().status, "ready");
  assert.equal(e.store.getSnapshot().items.length, 0);
  assert.equal(e.timers.size, 1);
  await e.advance(60_000 + JITTER_MIN_MS);
  const snap = e.store.getSnapshot();
  assert.deepEqual(snap.items.map((a) => a.id), ["R"]);
  assert.equal(isVisible(snap.items[0], snap.nowMs, none), true);
  assert.equal(e.timers.size, 0); // nothing further scheduled
});
test("S2 an expiring announcement disappears at its boundary even before the refetch resolves", async () => {
  const e = setup([row("R", { ends_at: iso(START + 30_000) })]);
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.store.getSnapshot().items.length, 1);
  let release!: () => void;
  e.ctl.hold = new Promise<void>((r) => { release = r; });
  await e.advance(30_000 + JITTER_MIN_MS); // timer fires; refetch is stuck on `hold`
  const during = e.store.getSnapshot();
  assert.equal(isVisible(during.items[0], during.nowMs, none), false); // local re-filter already hides it
  release();
  await flush();
  assert.equal(e.store.getSnapshot().items.length, 0);
});
test("S3 repeated and concurrent invalidate() calls never leave more than one timer", async () => {
  const e = setup([row("R", { starts_at: iso(START + 60_000) })]);
  e.store.subscribe(() => {});
  await flush();
  await e.store.invalidate();
  await e.store.invalidate();
  await Promise.all([e.store.invalidate(), e.store.invalidate(), e.store.invalidate()]);
  assert.equal(e.timers.size, 1);
});
test("S4 the delay is computed from server time, so a wrong device clock still fires at the right instant", async () => {
  const SKEW = -3_600_000; // device is 1 h ahead of the server
  const e = setup([row("R", { starts_at: iso(START + SKEW + 60_000) })], { skewMs: SKEW }); // starts 60 s from now in SERVER time
  e.store.subscribe(() => {});
  await flush();
  const [t] = [...e.timers.values()];
  assert.equal(t.at, START + 60_000 + JITTER_MIN_MS); // fires 60 s later on the device clock, not 1 h + 60 s
});
test("S5 jitter is always within [250, 3000] ms and never early", async () => {
  const lo = setup([row("R", { starts_at: iso(START + 60_000) })], { random: 0 });
  lo.store.subscribe(() => {});
  await flush();
  assert.equal([...lo.timers.values()][0].at, START + 60_000 + JITTER_MIN_MS);
  const hi = setup([row("R", { starts_at: iso(START + 60_000) })], { random: 0.999999 });
  hi.store.subscribe(() => {});
  await flush();
  assert.equal([...hi.timers.values()][0].at, START + 60_000 + JITTER_MAX_MS);
});
test("S6 a boundary beyond the 32-bit timer limit is capped, then re-armed when the capped timer fires", async () => {
  const far = START + 30 * 24 * 3_600_000; // 30 days
  const e = setup([row("R", { starts_at: iso(far) })]);
  e.store.subscribe(() => {});
  await flush();
  assert.equal([...e.timers.values()][0].at, START + MAX_TIMER_MS);
  const fetchesBefore = e.ctl.itemsCalls;
  await e.advance(MAX_TIMER_MS);
  assert.equal(e.ctl.itemsCalls, fetchesBefore + 1);
  assert.equal(e.timers.size, 1);
  assert.equal([...e.timers.values()][0].at, far + JITTER_MIN_MS);
});
test("S7 no upcoming boundary means no timer", async () => {
  const e = setup([row("R")]);
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.timers.size, 0);
});
test("S8 listeners and timer live only while subscribed (ref-counted); last unsubscribe cleans up", async () => {
  const e = setup([row("R", { starts_at: iso(START + 60_000) })]);
  const u1 = e.store.subscribe(() => {});
  const u2 = e.store.subscribe(() => {});
  await flush();
  assert.deepEqual([e.reg.visible.on, e.reg.online.on], [1, 1]);
  u1();
  assert.deepEqual([e.reg.visible.off, e.reg.online.off], [0, 0]);
  assert.equal(e.timers.size, 1);
  u2();
  u2(); // idempotent
  assert.deepEqual([e.reg.visible.off, e.reg.online.off], [1, 1]);
  assert.equal(e.timers.size, 0);
});
test("S9 becoming visible again: re-filters immediately and refetches only when stale or a boundary passed", async () => {
  const e = setup([row("R", { starts_at: iso(START + 10 * 60_000) })]);
  e.store.subscribe(() => {});
  await flush();
  const base = e.ctl.itemsCalls;
  e.setDevice(e.device() + 5_000); // fresh, before the boundary
  e.reg.visibleCb!();
  await flush();
  assert.equal(e.ctl.itemsCalls, base);
  assert.equal(e.store.getSnapshot().nowMs, e.server());
  e.setDevice(e.device() + STALE_MS + 1); // stale
  e.reg.visibleCb!();
  await flush();
  assert.equal(e.ctl.itemsCalls, base + 1);
  e.setDevice(START + 10 * 60_000 + 1); // background timer was throttled: boundary passed without firing
  e.reg.visibleCb!();
  await flush();
  assert.equal(e.ctl.itemsCalls, base + 2);
  assert.deepEqual(e.store.getSnapshot().items.map((a) => a.id), ["R"]);
});
test("S10 coming back online refetches only after a failed fetch", async () => {
  const e = setup([row("R")]);
  e.store.subscribe(() => {});
  await flush();
  const base = e.ctl.itemsCalls;
  e.reg.onlineCb!();
  await flush();
  assert.equal(e.ctl.itemsCalls, base);
  e.ctl.fail = true;
  await e.store.invalidate();
  assert.equal(e.store.getSnapshot().status, "error");
  e.ctl.fail = false;
  e.reg.onlineCb!();
  await flush();
  assert.equal(e.store.getSnapshot().status, "ready");
});
test("S11 a slow, older response never overwrites a newer one", async () => {
  const rows = [row("old")];
  const e = setup(rows);
  let release!: () => void;
  e.ctl.hold = new Promise<void>((r) => { release = r; });
  e.store.subscribe(() => {}); // first request is answered with [old] but its response is delayed
  await flush();
  rows.splice(0, rows.length, row("fresh")); // server data changes
  e.ctl.hold = null;
  await e.store.invalidate(); // newer request supersedes the first
  const afterSecond = e.store.getSnapshot();
  assert.deepEqual(afterSecond.items.map((a) => a.id), ["fresh"]);
  release(); // the stale first response finally arrives
  await flush();
  assert.equal(e.store.getSnapshot(), afterSecond);
  assert.deepEqual(e.store.getSnapshot().items.map((a) => a.id), ["fresh"]);
});
test("S12 a failed fetch sets error without throwing and keeps the previous items", async () => {
  const e = setup([row("R")]);
  e.store.subscribe(() => {});
  await flush();
  e.ctl.fail = true;
  await e.store.invalidate();
  const s = e.store.getSnapshot();
  assert.equal(s.status, "error");
  assert.deepEqual(s.items.map((a) => a.id), ["R"]);
  e.ctl.fail = false;
  await e.store.invalidate();
  assert.equal(e.store.getSnapshot().status, "ready");
});
test("S13 getSnapshot is referentially stable while nothing changes, and listeners are notified on change", async () => {
  const e = setup([row("R", { starts_at: iso(START + 60_000) })]);
  let notified = 0;
  e.store.subscribe(() => { notified++; });
  await flush();
  assert.equal(e.store.getSnapshot(), e.store.getSnapshot());
  const before = notified;
  await e.advance(60_000 + JITTER_MIN_MS);
  assert.ok(notified > before);
});
