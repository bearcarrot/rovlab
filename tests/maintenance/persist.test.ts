import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMaintenanceStore,
  type MaintenanceConfig,
  type PersistedMaintenance,
  type StoreDeps,
} from "../../src/features/maintenance/schedule.ts";

// Run: node --experimental-strip-types --test tests/maintenance/persist.test.ts
const NOW = Date.parse("2026-10-27T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const flush = () => new Promise<void>((r) => setImmediate(r));
const cfg = (o: Partial<MaintenanceConfig> = {}): MaintenanceConfig => ({
  enabled: false, startsAt: null, endsAt: null, message: "", etaNote: "", ...o,
});

function make(saved: PersistedMaintenance | null, server: MaintenanceConfig) {
  let calls = 0;
  const written: PersistedMaintenance[] = [];
  const deps: StoreDeps = {
    fetchConfig: async () => {
      calls++;
      return { config: server, serverNow: iso(NOW) };
    },
    now: () => NOW,
    setTimer: () => 1,
    clearTimer: () => {},
    random: () => 0,
    onVisible: () => () => {},
    onOnline: () => () => {},
    persist: { read: () => saved, write: (s) => { written.push(s); } },
  };
  return { store: createMaintenanceStore(deps), calls: () => calls, written };
}

test("P1 a recent saved answer (not active) skips the first request", async () => {
  const e = make({ at: NOW - 60_000, config: cfg(), offsetMs: 0 }, cfg());
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.calls(), 0);
  assert.equal(e.store.getSnapshot().status, "ready");
  assert.equal(e.store.getSnapshot().active, false);
});

test("P2 a saved answer that shows maintenance as active is never reused", async () => {
  const active = cfg({ enabled: true, startsAt: iso(NOW - 1000), endsAt: iso(NOW + 3_600_000) });
  const e = make({ at: NOW - 60_000, config: active, offsetMs: 0 }, cfg());
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.calls(), 1);
  assert.equal(e.store.getSnapshot().active, false); // the server answer (disabled) wins at once
});

test("P3 a saved answer from the future (clock moved back) is ignored", async () => {
  const e = make({ at: NOW + 60_000, config: cfg(), offsetMs: 0 }, cfg());
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.calls(), 1);
});

test("P4 a successful fetch writes the answer for the next reload", async () => {
  const e = make(null, cfg());
  e.store.subscribe(() => {});
  await flush();
  assert.equal(e.calls(), 1);
  assert.equal(e.written.length, 1);
  assert.equal(e.written[0].at, NOW);
  assert.equal(e.written[0].config.enabled, false);
});
