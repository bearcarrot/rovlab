import { test } from "node:test";
import assert from "node:assert/strict";
import { splitRecs } from "../../src/features/draft/splitRecs.ts";

const r = (id: string, ...tags: string[]) => ({ hero: { id }, tags });
const ids = (l: { hero: { id: string } }[]) => l.map((x) => x.hero.id);

test("counter > synergy > overall, no hero in two places", () => {
  const s = splitRecs([r("a", "counter", "synergy"), r("b", "synergy"), r("c"), r("d", "counter"), r("e")], 6, 5);
  assert.deepEqual(ids(s.counter), ["a", "d"]);
  assert.deepEqual(ids(s.synergy), ["b"]);
  assert.deepEqual(ids(s.overall), ["c", "e"]);
});

test("hero beyond the counter cap falls to overall instead of vanishing", () => {
  const s = splitRecs([r("a", "counter"), r("b", "counter"), r("c")], 1, 5);
  assert.deepEqual(ids(s.counter), ["a"]);
  assert.deepEqual(ids(s.overall), ["b", "c"]);
});

test("empty team / no relations: everything is overall, capped", () => {
  const s = splitRecs([r("a"), r("b"), r("c")], 6, 2);
  assert.deepEqual([ids(s.counter), ids(s.synergy), ids(s.overall)], [[], [], ["a", "b"]]);
});
