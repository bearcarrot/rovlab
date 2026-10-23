import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_HEROES,
  MAX_LANES,
  addLane,
  emptyLanes,
  emptyTierData,
  findLane,
  lanesCustomized,
  lanesHeroCount,
  lanesSig,
  moveHero,
  parseLaneDraft,
  parseLanes,
  parseTierData,
  removeLane,
  serializeLanes,
  serializeTierData,
  tierSig,
  updateLaneRows,
  updateRow,
  type TierLanes,
} from "../../src/features/tierlist/tierData.ts";

const row = (id: string, heroes: string[]) => ({ id, label: id.toUpperCase(), color: "#112233", heroes });
const heroesOf = (ls: TierLanes, lane: string, rowId: string) => findLane(ls, lane)!.rows.find((r) => r.id === rowId)!.heroes;

test("legacy fixed tiers and v2 rows open as ONE lane \"all\" (nothing lost, nothing rewritten)", () => {
  const legacy = parseLanes({ "S+": ["a", "b"], S: ["c"] });
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].id, "all");
  assert.deepEqual(heroesOf(legacy, "all", "s-plus"), ["a", "b"]);

  const v2 = parseLanes({ v: 2, rows: [row("x1", ["h1"]), row("x2", [])] });
  assert.deepEqual(v2, [{ id: "all", rows: [{ id: "x1", label: "X1", color: "#112233", heroes: ["h1"] }, { id: "x2", label: "X2", color: "#112233", heroes: [] }] }]);
  assert.deepEqual(v2[0].rows, parseTierData({ v: 2, rows: [row("x1", ["h1"]), row("x2", [])] }));
});

test("garbage never throws; malformed v3 falls back to a usable default board instead of an empty list", () => {
  for (const bad of [null, undefined, 5, "x", true, []]) assert.equal(parseLanes(bad).length, 1);
  assert.deepEqual(parseLanes({ v: 3, lanes: "nope" }), emptyLanes());
  assert.deepEqual(parseLanes({ v: 3, lanes: [] }), emptyLanes());
  assert.deepEqual(parseLanes({ v: 3, lanes: [null, 7, { id: "nope", rows: [] }] }), emptyLanes());
});

test("v3 round trip keeps every lane with its own rows, colors and hero order", () => {
  const lanes: TierLanes = [
    { id: "jungle", rows: [row("s", ["a", "b"]), row("a", ["c"])] },
    { id: "mid", rows: [row("only", ["z", "a"])] },
    { id: "roaming", rows: emptyTierData() },
  ];
  const json = JSON.parse(JSON.stringify(serializeLanes(lanes)));
  assert.equal(json.v, 3);
  const back = parseLanes(json);
  assert.deepEqual(back.map((l) => l.id), ["jungle", "mid", "roaming"]);
  assert.deepEqual(heroesOf(back, "jungle", "s"), ["a", "b"]);
  assert.deepEqual(back[1].rows.map((r) => r.id), ["only"]); // lanes may have different row counts
  assert.equal(back[2].rows.length, 5);
  assert.equal(lanesSig(back), lanesSig(lanes));
});

test("a single \"all\" lane is written exactly like before lanes existed (v2)", () => {
  const rows = [row("x1", ["h1"])];
  assert.deepEqual(serializeLanes([{ id: "all", rows }]), serializeTierData(rows));
  assert.equal(serializeLanes([{ id: "all", rows }]).v, 2);
  assert.equal(serializeLanes([{ id: "jungle", rows }]).v, 3); // one non-"all" lane still needs v3 to keep its identity
});

test("lane ids: duplicates and unknown ids are dropped, at most MAX_LANES", () => {
  const parsed = parseLanes({
    v: 3,
    lanes: [
      { id: "jungle", rows: [row("a", ["h1"])] },
      { id: "jungle", rows: [row("a", ["h2"])] },
      { id: "carry", rows: [] },
      { id: "mid", rows: [row("a", [])] },
    ],
  });
  assert.deepEqual(parsed.map((l) => l.id), ["jungle", "mid"]);
  assert.deepEqual(heroesOf(parsed, "jungle", "a"), ["h1"]); // first one wins, second is not merged
  assert.equal(MAX_LANES, 6);
});

test("same hero may live on several lanes, but never twice inside one lane", () => {
  const parsed = parseLanes({
    v: 3,
    lanes: [
      { id: "jungle", rows: [row("a", ["h1", "h1"]), row("b", ["h1", "h2"])] },
      { id: "mid", rows: [row("a", ["h1"])] },
    ],
  });
  assert.deepEqual(heroesOf(parsed, "jungle", "a"), ["h1"]);
  assert.deepEqual(heroesOf(parsed, "jungle", "b"), ["h2"]);
  assert.deepEqual(heroesOf(parsed, "mid", "a"), ["h1"]);
  assert.equal(lanesHeroCount(parsed), 2); // h1 counted once, matches tier_hero_count (distinct) in the DB
});

test("limits are per lane: 200 heroes each, 20 rows each", () => {
  const ids = (p: string) => Array.from({ length: 500 }, (_, i) => `${p}${i}`);
  const parsed = parseLanes({
    v: 3,
    lanes: [
      { id: "jungle", rows: [row("a", ids("j"))] },
      { id: "mid", rows: Array.from({ length: 30 }, (_, i) => row(`r${i}`, [])) },
    ],
  });
  assert.equal(parsed[0].rows[0].heroes.length, MAX_HEROES);
  assert.equal(parsed[1].rows.length, 20);
  // a full jungle board does not stop mid from also holding 200
  const both = parseLanes({ v: 3, lanes: [{ id: "jungle", rows: [row("a", ids("x"))] }, { id: "mid", rows: [row("a", ids("x"))] }] });
  assert.equal(both[0].rows[0].heroes.length, MAX_HEROES);
  assert.equal(both[1].rows[0].heroes.length, MAX_HEROES);
  assert.equal(lanesHeroCount(both), MAX_HEROES);
});

test("editing one lane leaves every other lane untouched (same object identity)", () => {
  const start = parseLanes({ v: 3, lanes: [{ id: "jungle", rows: [row("a", ["h1"])] }, { id: "mid", rows: [row("a", ["h1", "h2"])] }] });
  const next = updateLaneRows(start, "jungle", (rows) => moveHero(rows, "h1", null));
  assert.deepEqual(heroesOf(next, "jungle", "a"), []);
  assert.deepEqual(heroesOf(next, "mid", "a"), ["h1", "h2"]);
  assert.equal(findLane(next, "mid"), findLane(start, "mid"));
  // renaming a row in one lane
  const renamed = updateLaneRows(start, "mid", (rows) => updateRow(rows, "a", { label: "God" }));
  assert.equal(findLane(renamed, "mid")!.rows[0].label, "God");
  assert.equal(findLane(renamed, "jungle"), findLane(start, "jungle"));
  // no-ops return the same array (no needless dirty state)
  assert.equal(updateLaneRows(start, "jungle", (rows) => rows), start);
  assert.equal(updateLaneRows(start, "roaming", (rows) => moveHero(rows, "h", null)), start);
});

test("add / remove lane keeps the other lanes' data; cannot drop the last lane; no duplicate lane", () => {
  let ls: TierLanes = emptyLanes();
  ls = updateLaneRows(ls, "all", (rows) => moveHero(rows, "h1", "s"));
  ls = addLane(ls, "jungle");
  ls = addLane(ls, "mid");
  assert.deepEqual(ls.map((l) => l.id), ["all", "jungle", "mid"]);
  assert.equal(addLane(ls, "jungle"), ls); // duplicate lane name not allowed
  assert.equal(addLane(ls, "bogus" as never), ls);
  ls = updateLaneRows(ls, "jungle", (rows) => moveHero(rows, "h2", "a"));
  const without = removeLane(ls, "mid");
  assert.deepEqual(without.map((l) => l.id), ["all", "jungle"]);
  assert.deepEqual(heroesOf(without, "all", "s"), ["h1"]);
  assert.deepEqual(heroesOf(without, "jungle", "a"), ["h2"]);
  assert.equal(removeLane(ls, "roaming"), ls); // unknown lane
  const single = removeLane(removeLane(without, "jungle"), "all");
  assert.equal(single.length, 1); // last lane stays
  let full: TierLanes = emptyLanes();
  for (const id of ["slayer", "jungle", "mid", "abyssal", "roaming"] as const) full = addLane(full, id);
  assert.equal(full.length, MAX_LANES);
});

test("dirty-state signature sees an edit in ANY lane, and ignores which lane is open", () => {
  const base = parseLanes({ v: 3, lanes: [{ id: "jungle", rows: [row("a", ["h1"])] }, { id: "mid", rows: [row("a", [])] }] });
  const sig = lanesSig(base);
  assert.equal(lanesSig(parseLanes(JSON.parse(JSON.stringify(serializeLanes(base))))), sig); // reopen after save: not dirty
  assert.notEqual(lanesSig(updateLaneRows(base, "mid", (rows) => moveHero(rows, "h9", "a"))), sig); // non-first lane
  assert.notEqual(lanesSig(updateLaneRows(base, "jungle", (rows) => updateRow(rows, "a", { color: "#000000" }))), sig);
  assert.notEqual(lanesSig(addLane(base, "roaming")), sig);
  assert.notEqual(lanesSig(removeLane(base, "mid")), sig);
  assert.equal(tierSig(base[0].rows), tierSig(parseLanes(serializeLanes(base))[0].rows));
});

test("lanesCustomized: a pristine single board is not work; extra lanes or edited rows are", () => {
  assert.equal(lanesCustomized(emptyLanes()), false);
  assert.equal(lanesCustomized(addLane(emptyLanes(), "mid")), true);
  assert.equal(lanesCustomized([{ id: "jungle", rows: emptyTierData() }]), true);
  assert.equal(lanesCustomized(updateLaneRows(emptyLanes(), "all", (rows) => updateRow(rows, "a", { label: "A+" }))), true);
});

test("local draft recovery: v1 / v2 open as one lane, v3 keeps all lanes, unknown or malformed is rejected (not emptied)", () => {
  const v1 = parseLaneDraft({ version: 1, name: "Old", patch: "1", tiers: { "S+": ["a"] } });
  assert.equal(v1?.lanes.length, 1);
  assert.deepEqual(heroesOf(v1!.lanes, "all", "s-plus"), ["a"]);
  const v2 = parseLaneDraft({ version: 2, name: "Mid", patch: "", tiers: [row("q", ["z"])] });
  assert.deepEqual(heroesOf(v2!.lanes, "all", "q"), ["z"]);
  const v3 = parseLaneDraft({ version: 3, name: "New", patch: "2", lanes: [{ id: "jungle", rows: [row("q", ["z"])] }, { id: "mid", rows: [row("q", ["y"])] }] });
  assert.deepEqual(v3?.lanes.map((l) => l.id), ["jungle", "mid"]);
  assert.equal(v3?.patch, "2");
  assert.equal(parseLaneDraft({ version: 4, name: "x", lanes: [] }), null); // newer than this build: caller backs it up
  assert.equal(parseLaneDraft({ version: 3, name: "x", lanes: "no" }), null);
  assert.equal(parseLaneDraft({ version: 3, lanes: [] }), null);
  assert.equal(parseLaneDraft(null), null);
  assert.equal(parseLaneDraft({ version: 3, name: "x".repeat(100), lanes: [] })?.name.length, 40);
});
