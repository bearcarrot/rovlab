import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAnnouncementStore,
  type PersistedAnnouncements,
  type StoreDeps,
} from "../../src/features/announcements/schedule.ts";
import type { Announcement } from "../../src/features/announcements/types.ts";

// Run: node --experimental-strip-types --test tests/announcements/persist.test.ts
const NOW = Date.parse("2026-10-27T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const flush = () => new Promise<void>((r) => setImmediate(r));
const item = { id: "a1", title: "t" } as unknown as Announcement;

function make(saved: PersistedAnnouncements | null) {
  let itemCalls = 0;
  let scheduleCalls = 0;
  const written: PersistedAnnouncements[] = [];
  const deps: StoreDeps = {
    fetchItems: async () => {
      itemCalls++;
      return [item];
    },
    fetchSchedule: async () => {
      scheduleCalls++;
      return { serverNow: iso(NOW), nextChange: null };
    },
    now: () => NOW,
    setTimer: () => 1,
    clearTimer: () => {},
    random: () => 0,
    onVisible: () => () => {},
    onOnline: () => () => {},
    persist: { read: () => saved, write: (s) => { written.push(s); } },
  };
  return { store: createAnnouncementStore(deps), calls: () => itemCalls + scheduleCalls, written };
}

test("A1 a recent saved answer with no change due skips both requests", async () => {
  const e = make({ at: NOW - 60_000, items: [item], offsetMs: 0, nextChangeMs: null });
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.calls(), 0);
  assert.equal(e.store.getSnapshot().status, "ready");
  assert.deepEqual(e.store.getSnapshot().items, [item]);
});

test("A2 a saved answer is reused while the next change is still in the future", async () => {
  const e = make({ at: NOW - 60_000, items: [item], offsetMs: 0, nextChangeMs: NOW + 120_000 });
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.calls(), 0);
});

test("A3 a saved answer whose next change has passed is not reused", async () => {
  const e = make({ at: NOW - 60_000, items: [], offsetMs: 0, nextChangeMs: NOW - 1 });
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.calls(), 2);
  assert.deepEqual(e.store.getSnapshot().items, [item]);
});

test("A4 a successful fetch writes items, offset and next change for the next reload", async () => {
  const e = make(null);
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.written.length, 1);
  assert.equal(e.written[0].at, NOW);
  assert.deepEqual(e.written[0].items, [item]);
  assert.equal(e.written[0].nextChangeMs, null);
});
