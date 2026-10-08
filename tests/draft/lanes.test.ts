import { test } from "node:test";
import assert from "node:assert/strict";
import { collectLanes, filterByMissingLanes, getMissingLanes } from "../../src/features/draft/laneCoverage.ts";

const ALL = ["slayer", "jungle", "mid", "abyssal", "roaming"];

test("covered lane is no longer missing (Dolia roaming => Thane roaming not needed)", () => {
  const missing = getMissingLanes([["roaming"]], ALL);
  assert.deepEqual(missing, ["slayer", "jungle", "mid", "abyssal"]);
  const pool = [
    { n: "Thane", lanes: ["roaming"] },
    { n: "Nakroth", lanes: ["jungle"] },
    { n: "Zata", lanes: ["mid"] },
  ];
  assert.deepEqual(filterByMissingLanes(pool, (h) => h.lanes, missing).map((h) => h.n), ["Nakroth", "Zata"]);
});

test("flexible heroes are matched so every lane they can cover counts", () => {
  // jungle/mid + mid-only: matching puts the first in jungle and the second in mid
  assert.deepEqual(getMissingLanes([["jungle", "mid"], ["mid"]], ALL), ["slayer", "abyssal", "roaming"]);
  // two roaming-only heroes can only fill roaming once
  assert.deepEqual(getMissingLanes([["roaming"], ["roaming"]], ALL), ["slayer", "jungle", "mid", "abyssal"]);
});

test("empty team misses every lane; full coverage misses none", () => {
  assert.deepEqual(getMissingLanes([], ALL), ALL);
  assert.deepEqual(getMissingLanes([["slayer"], ["jungle"], ["mid"], ["abyssal"], ["roaming"]], ALL), []);
});

test("heroes without lane data are kept; empty result falls back to everything", () => {
  const unknown = { n: "?", lanes: [] as string[] };
  assert.deepEqual(filterByMissingLanes([unknown, { n: "T", lanes: ["roaming"] }], (h) => h.lanes, ["mid"]).map((h) => h.n), ["?"]);
  const onlyCovered = [{ n: "T", lanes: ["roaming"] }];
  assert.equal(filterByMissingLanes(onlyCovered, (h) => h.lanes, ["mid"]), onlyCovered);
  assert.equal(filterByMissingLanes(onlyCovered, (h) => h.lanes, []), onlyCovered);
});

test("collectLanes orders by the usual lane order", () => {
  assert.deepEqual(collectLanes([["roaming", "mid"], ["slayer", "custom"]]), ["slayer", "mid", "roaming", "custom"]);
});
