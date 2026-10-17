import { test } from "node:test";
import assert from "node:assert/strict";
import { createDismissalStore, dismissAnnouncement, syncOnSignIn, type StorageLike } from "../../src/features/announcements/dismissals.ts";

// Run: node --experimental-strip-types --test tests/announcements/dismissals.test.ts  (Node >= 22.6)
const KEY = "rovlab:announcements:dismissed:v1";
function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}
const throwing: StorageLike = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };
let tick = 0;
const clock = () => Date.UTC(2026, 9, 17) + tick++ * 1000;

test("D1 add and has are per announcement id", () => {
  const s = createDismissalStore(fakeStorage(), clock);
  assert.equal(s.has("a"), false);
  assert.equal(s.add("a"), "ok");
  assert.equal(s.has("a"), true);
  assert.equal(s.has("b"), false);
});
test("D2 nothing prunes or removes dismissals (no remove/clear/prune API; mirror only adds)", () => {
  const s = createDismissalStore(fakeStorage(), clock) as unknown as Record<string, unknown>;
  for (const name of ["remove", "delete", "clear", "prune", "reset"]) assert.equal(typeof s[name], "undefined", name);
  const store = createDismissalStore(fakeStorage(), clock);
  store.add("a");
  store.mirror(["b"]);
  assert.deepEqual([...store.ids()].sort(), ["a", "b"]);
});
test("D3 cap of 1000 evicts only the oldest entries", () => {
  const s = createDismissalStore(fakeStorage(), clock);
  for (let i = 0; i < 1001; i++) s.add(`id-${i}`);
  assert.equal(s.ids().size, 1000);
  assert.equal(s.has("id-0"), false);
  assert.equal(s.has("id-1"), true);
  assert.equal(s.has("id-1000"), true);
});
test("D4 corrupt JSON is ignored and rewritten", () => {
  const st = fakeStorage({ [KEY]: "{not json" });
  const s = createDismissalStore(st, clock);
  assert.equal(s.has("x"), false);
  assert.equal(s.add("x"), "ok");
  const parsed = JSON.parse(st.data[KEY]);
  assert.equal(parsed.v, 1);
  assert.ok("x" in parsed.ids);
});
test("D5 throwing or missing storage: add reports failed but the id stays hidden in memory", () => {
  for (const storage of [throwing, null]) {
    const s = createDismissalStore(storage, clock);
    assert.equal(s.add("a"), "failed");
    assert.equal(s.has("a"), true);
    assert.equal(s.add("b"), "failed");
    assert.deepEqual([...s.ids()].sort(), ["a", "b"]);
  }
});
test("D6 two stores on one storage do not clobber each other (re-read before write)", () => {
  const st = fakeStorage();
  const a = createDismissalStore(st, clock);
  const b = createDismissalStore(st, clock);
  a.add("x");
  b.add("y");
  assert.equal(createDismissalStore(st, clock).has("x"), true);
  assert.equal(createDismissalStore(st, clock).has("y"), true);
  assert.equal(a.has("y"), true);
});
test("D7 dismissAnnouncement signed out: local ok, server skipped, nothing pushed", async () => {
  const pushed: string[][] = [];
  const r = await dismissAnnouncement("a", { store: createDismissalStore(fakeStorage(), clock), signedIn: false, push: async (ids) => { pushed.push(ids); } });
  assert.deepEqual(r, { local: "ok", server: "skipped" });
  assert.equal(pushed.length, 0);
});
test("D8 dismissAnnouncement signed in: server ok pushes exactly this id", async () => {
  const pushed: string[][] = [];
  const store = createDismissalStore(fakeStorage(), clock);
  const r = await dismissAnnouncement("a", { store, signedIn: true, push: async (ids) => { pushed.push(ids); } });
  assert.deepEqual(r, { local: "ok", server: "ok" });
  assert.deepEqual(pushed, [["a"]]);
  assert.deepEqual(store.pending(), []);
});
test("D9 server failure is reported as failed (never ok) and queued as pending", async () => {
  const store = createDismissalStore(fakeStorage(), clock);
  const r = await dismissAnnouncement("a", { store, signedIn: true, push: async () => { throw new Error("network"); } });
  assert.deepEqual(r, { local: "ok", server: "failed" });
  assert.deepEqual(store.pending(), ["a"]);
  assert.equal(store.has("a"), true);
});
test("D10 local failure is reported: signed out and signed in", async () => {
  const out = await dismissAnnouncement("a", { store: createDismissalStore(throwing, clock), signedIn: false, push: async () => {} });
  assert.deepEqual(out, { local: "failed", server: "skipped" });
  const inn = await dismissAnnouncement("a", { store: createDismissalStore(null, clock), signedIn: true, push: async () => {} });
  assert.deepEqual(inn, { local: "failed", server: "ok" });
});
test("D11 sign-in pushes only local-only and pending ids in chunks of at most 200, mirrors server ids, keeps local ids", async () => {
  const store = createDismissalStore(fakeStorage(), clock);
  const localOnly = Array.from({ length: 450 }, (_, i) => `l${i}`);
  for (const id of localOnly) store.add(id);
  store.add("onServer");
  store.addPending("l0");
  const calls: string[][] = [];
  const result = await syncOnSignIn({ store, fetchServerIds: async () => ["onServer", "serverOnly"], push: async (ids) => { calls.push(ids); } });
  assert.deepEqual(calls.map((c) => c.length), [200, 200, 50]);
  assert.equal(calls.flat().includes("onServer"), false);
  assert.equal(new Set(calls.flat()).size, 450);
  assert.equal(result.has("serverOnly"), true);
  assert.equal(store.has("serverOnly"), true);
  assert.equal(result.has("l449"), true);
  assert.equal(store.has("l0"), true);
  assert.deepEqual(store.pending(), []);
});
test("D12 sign-in push failure keeps ids hidden and queues them as pending; it never throws", async () => {
  const store = createDismissalStore(fakeStorage(), clock);
  store.add("a");
  const result = await syncOnSignIn({ store, fetchServerIds: async () => [], push: async () => { throw new Error("rpc down"); } });
  assert.equal(result.has("a"), true);
  assert.deepEqual(store.pending(), ["a"]);
});
test("D13 sign-in with an unreachable server returns the local set untouched", async () => {
  const store = createDismissalStore(fakeStorage(), clock);
  store.add("a");
  const result = await syncOnSignIn({ store, fetchServerIds: async () => { throw new Error("offline"); }, push: async () => { throw new Error("must not be called"); } });
  assert.deepEqual([...result], ["a"]);
});
test("D14 pending ids already on the server are cleared without pushing", async () => {
  const store = createDismissalStore(fakeStorage(), clock);
  store.add("a");
  store.addPending("a");
  let pushed = 0;
  await syncOnSignIn({ store, fetchServerIds: async () => ["a"], push: async () => { pushed++; } });
  assert.equal(pushed, 0);
  assert.deepEqual(store.pending(), []);
});
