import { test } from "node:test";
import assert from "node:assert/strict";

// Run: node --experimental-strip-types --test tests/build/catalogCache.test.ts
// Models how services/gameCatalog.ts + services/items.ts share one raw "catalog:items" cache (the services themselves
// import app aliases, so the same cached()/view functions are composed here with a counting loader).
const mem = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    },
  },
});
const { cached, clearCache, setCacheBypass } = await import("../../src/lib/ttlCache.ts");
const { toCatalogItems, toCatalogRunes, byCostDesc, isVerified } = await import("../../src/lib/catalogRows.ts");
const TTL = 5 * 60 * 1000;

const row = (slug: string, cost: number, verified: boolean, extra: object = {}) => ({
  id: `id-${slug}`, slug, name: slug.toUpperCase(), name_th: slug, cost, tier: 2, role_tags: ["attack"], stats: ["+1"], passive: "p", icon_url: null,
  verified_at: verified ? "2026-10-01T00:00:00Z" : null, ...extra,
});
const ROWS = [row("a-ring", 600, true), row("b-sword", 2000, true), row("c-draft", 2000, false), row("d-boots", 700, true)];

let loads = 0;
const loadRows = async () => (loads++, ROWS);
const itemRows = () => cached("catalog:items", TTL, loadRows, (v) => v.length > 0);
const gameDataItems = async () => toCatalogItems(await itemRows()); // Game Data Library / Detail / Neighbors / Build Editor
const buildItems = async () => byCostDesc(await itemRows()); // Hero Detail / Item Build

const reset = () => {
  clearCache("");
  mem.clear();
  setCacheBypass(false);
  loads = 0;
};
const reload = () => {
  const saved = new Map(mem);
  clearCache("");
  mem.clear();
  for (const [k, v] of saved) mem.set(k, v);
};

test("G1 Hero Detail -> Game Data -> Game Data Detail: one request for items", async () => {
  reset();
  await buildItems();
  await gameDataItems();
  const found = (await gameDataItems()).find((i) => i.slug === "b-sword");
  assert.equal(found?.cost, 2000);
  assert.equal(loads, 1);
});

test("G2 simultaneous callers share one in-flight request", async () => {
  reset();
  await Promise.all([buildItems(), gameDataItems(), gameDataItems(), buildItems()]);
  assert.equal(loads, 1);
});

test("G3 shared cache survives a reload (persisted), for every catalog key", async () => {
  reset();
  await gameDataItems();
  reload();
  await buildItems();
  assert.equal(loads, 1);
  for (const key of ["catalog:runes", "catalog:spells", "catalog:enchantments"]) {
    let n = 0;
    const load = async () => (n++, [{ id: key }]);
    await cached(key, TTL, load);
    reload();
    await cached(key, TTL, load);
    assert.equal(n, 1, key);
  }
});

test("G4 expired and malformed persisted entries are discarded and reloaded", async () => {
  reset();
  await itemRows();
  const k = "rovlab:cache:v2:catalog:items";
  const saved = JSON.parse(mem.get(k)!);
  mem.set(k, JSON.stringify({ ...saved, at: Date.now() - 16 * 60 * 1000 })); // older than the 15 min persist TTL
  clearCache("catalog:items"); // drop memory only is not possible: clear both, then re-seed storage
  mem.set(k, JSON.stringify({ ...saved, at: Date.now() - 16 * 60 * 1000 }));
  await itemRows();
  assert.equal(loads, 2);
  assert.ok(JSON.parse(mem.get(k)!).at > Date.now() - 5000, "fresh copy written back");

  clearCache("");
  mem.set(k, "{not json");
  await itemRows();
  assert.equal(loads, 3);
});

test("G5 a failed request is not cached and the next call retries", async () => {
  reset();
  let fail = true;
  const flaky = () => cached("catalog:items", TTL, async () => (loads++, fail ? Promise.reject(new Error("net")) : ROWS));
  await assert.rejects(flaky());
  fail = false;
  assert.equal((await flaky()).length, 4);
  assert.equal(loads, 2);
  assert.equal((await flaky()).length, 4);
  assert.equal(loads, 2);
});

test("G6 an empty result is not cached; bypass (admin) and clearCache force a fresh load", async () => {
  reset();
  let rowsNow: typeof ROWS = [];
  const load = async () => (loads++, rowsNow);
  await cached("catalog:items", TTL, load, (v) => v.length > 0);
  rowsNow = ROWS;
  await cached("catalog:items", TTL, load, (v) => v.length > 0);
  assert.equal(loads, 2);
  await cached("catalog:items", TTL, load, (v) => v.length > 0);
  assert.equal(loads, 2);
  setCacheBypass(true); // admin: always fresh, nothing kept
  await itemRows();
  await itemRows();
  assert.equal(loads, 4);
  setCacheBypass(false);
  clearCache("catalog:");
  await itemRows();
  assert.equal(loads, 5);
});

test("G7 Game Data only sees verified rows; builds still resolve every row", async () => {
  reset();
  assert.deepEqual((await gameDataItems()).map((i) => i.slug), ["a-ring", "b-sword", "d-boots"]);
  assert.ok((await buildItems()).some((i) => i.slug === "c-draft"), "unverified item still resolvable for a build that references it");
  assert.equal(isVerified({ verified_at: null }), false);
  assert.equal(isVerified({}), false);
  assert.equal(isVerified({ verified_at: "2026-10-01" }), true);
});

test("G8 build item order is cost desc with name order kept on ties; cached rows are not mutated", async () => {
  reset();
  const before = (await itemRows()).map((r) => r.slug);
  assert.deepEqual((await buildItems()).map((i) => i.slug), ["b-sword", "c-draft", "d-boots", "a-ring"]);
  assert.deepEqual((await itemRows()).map((r) => r.slug), before);
});

test("G9 runes: verified filter, null color/description defaults, legacy unverified rune stays out of Game Data", () => {
  const runes = [
    { id: "r1", name: "Sage", description: null, color: null, icon_url: "i", verified_at: "x" },
    { id: "r2", name: "Old", description: "d", color: "red", icon_url: null, verified_at: null },
  ];
  assert.deepEqual(toCatalogRunes(runes), [{ id: "r1", name: "Sage", description: "", color: null, icon: "i" }]);
});

test("G10 per-user keys are never persisted next to catalog keys", async () => {
  reset();
  await cached("catalog:items", TTL, async () => ROWS);
  await cached("combos:me", TTL, async () => ["secret"]);
  reload();
  assert.equal([...mem.keys()].some((k) => k.includes("combos:me")), false);
});
