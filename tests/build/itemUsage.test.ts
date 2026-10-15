import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHeroItemStats } from "../../src/features/build/itemUsage.ts";

// Run: node --experimental-strip-types --test tests/build/itemUsage.test.ts  (Node >= 22.6, no extra deps)
const item = (slug: string, matches: number, over: Record<string, unknown> = {}) => ({ item_id: `id-${slug}`, slug, matches, wins: 0, pick_rate: 0, slots: { "1": matches }, ...over });
const ok = (items: unknown[], over: Record<string, unknown> = {}) => ({ eligible: 200, users: 12, wins: 100, suppressed: false, items, ...over });

test("pick rate = matches / eligible, recomputed (illustrative numbers: 120 of 200 = 60%)", () => {
  const r = parseHeroItemStats(ok([item("a", 120, { pick_rate: 99 })]));
  assert.equal(r.items[0].pickRate, 60);
  assert.equal(r.eligible, 200);
  assert.equal(r.suppressed, false);
});

test("sorted by matches, one decimal", () => {
  const r = parseHeroItemStats(ok([item("a", 10), item("b", 77), item("c", 1)], { eligible: 300 }));
  assert.deepEqual(r.items.map((i) => i.slug), ["b", "a", "c"]);
  assert.equal(r.items[0].pickRate, 25.7);
});

test("suppressed / empty / malformed never render as statistics", () => {
  for (const raw of [null, undefined, "x", {}, { eligible: 5, users: 1, suppressed: true, items: [] }, ok([item("a", 1)], { suppressed: true }), ok([item("a", 1)], { eligible: 0 }), ok("nope" as never)]) {
    const r = parseHeroItemStats(raw);
    assert.equal(r.suppressed, true);
    assert.deepEqual(r.items, []);
  }
});

test("impossible or broken rows are dropped, good rows kept", () => {
  const r = parseHeroItemStats(ok([item("a", 201), item("b", -1), { slug: "c", matches: 5 }, item("d", 50)]));
  assert.deepEqual(r.items.map((i) => i.slug), ["d"]);
});

test("slot distribution keeps only slots 1-6", () => {
  const r = parseHeroItemStats(ok([item("a", 10, { slots: { "1": 4, "6": 6, "7": 9, x: 1 } })]));
  assert.deepEqual(r.items[0].slots, { 1: 4, 6: 6 });
});
