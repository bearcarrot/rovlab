import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCuratedLaneGrid, orderLanes } from "../../src/features/tierlist/laneGrid.ts";
import { heroLanes } from "../../src/lib/heroPositions.ts";

const hero = (id: string, lane: string, lanes?: string[]) => ({ id, name: id.toUpperCase(), icon: `https://x/${id}.webp`, lane, lanes });
const laneOf = heroLanes as unknown as (h: { lane: string; lanes?: string[] }) => string[];
const TIERS = ["S+", "S", "A", "B", "C"];
const lists = (o: Record<string, Record<string, string>>) => new Map(Object.entries(o).map(([k, v]) => [k, new Map(Object.entries(v))]));
const build = (heroes: ReturnType<typeof hero>[], l: ReturnType<typeof lists>, extra: { tier?: string | null; lanes?: string[] } = {}) =>
  buildCuratedLaneGrid(heroes, l, { lanes: extra.lanes ?? orderLanes(), laneOf, tiers: TIERS, allKey: "all", tier: extra.tier });
const ids = (hs: { id: string }[]) => hs.map((h) => h.id);
const cell = (g: ReturnType<typeof build>, tier: string, lane: string) => ids(g.rows.find((r) => r.label === tier)?.cells[lane] ?? []);

test("one hero is S+ in Jungle and A in Slayer (own lane lists), and nothing leaks between lanes", () => {
  const a = hero("a", "jungle", ["jungle", "slayer"]);
  const g = build([a], lists({ all: { a: "S" }, jungle: { a: "S+" }, slayer: { a: "A" } }));
  assert.deepEqual(cell(g, "S+", "jungle"), ["a"]);
  assert.deepEqual(cell(g, "A", "slayer"), ["a"]);
  assert.deepEqual(cell(g, "S+", "slayer"), []);
  assert.deepEqual(cell(g, "A", "jungle"), []);
  assert.deepEqual(cell(g, "S", "jungle"), []); // the all-lanes tier does not leak into a lane that has its own list
  assert.deepEqual(cell(g, "S", "slayer"), []);
});

test("a lane with its own list shows only heroes in that list; a lane without one falls back to the all-lanes tier", () => {
  const a = hero("a", "mid", ["mid", "jungle"]);
  const b = hero("b", "mid");
  const g = build([a, b], lists({ all: { a: "A", b: "B" }, jungle: { b: "S" } }));
  assert.deepEqual(cell(g, "S", "jungle"), ["b"]); // b is listed for jungle even though it is not tagged jungle
  assert.deepEqual(cell(g, "A", "jungle"), []); // a is tagged jungle but absent from the jungle list: not invented
  assert.deepEqual(cell(g, "A", "mid"), ["a"]); // mid has no list: all-lanes tier for heroes tagged mid
  assert.deepEqual(cell(g, "B", "mid"), ["b"]);
});

test("only the all-lanes list: every lane uses the same tier (previous behavior)", () => {
  const a = hero("a", "mid", ["mid", "jungle"]);
  const g = build([a], lists({ all: { a: "S" } }));
  assert.deepEqual(cell(g, "S", "mid"), ["a"]);
  assert.deepEqual(cell(g, "S", "jungle"), ["a"]);
  assert.deepEqual(cell(g, "S", "slayer"), []);
});

test("tier filter keeps only that row; empty rows are dropped; cells are A-Z", () => {
  const g = build([hero("b", "mid"), hero("a", "mid"), hero("c", "mid")], lists({ all: { a: "S", b: "S", c: "A" } }), { tier: "S" });
  assert.deepEqual(g.rows.map((r) => r.label), ["S"]);
  assert.deepEqual(cell(g, "S", "mid"), ["a", "b"]);
});

test("a hero with no visible lane goes to unassigned under its all-lanes tier", () => {
  const g = build([hero("z", "newlane")], lists({ all: { z: "B" } }));
  assert.equal(g.hasUnassigned, true);
  assert.deepEqual(ids(g.rows[0].unassigned), ["z"]);
});

test("building the grid does not mutate its inputs", () => {
  const heroes = [hero("a", "jungle", ["jungle", "slayer"])];
  const l = lists({ all: { a: "S" }, jungle: { a: "S+" } });
  const before = JSON.stringify([heroes, [...l].map(([k, v]) => [k, [...v]])]);
  build(heroes, l);
  assert.equal(JSON.stringify([heroes, [...l].map(([k, v]) => [k, [...v]])]), before);
});
