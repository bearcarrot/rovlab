import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LANES, OTHER_LANE, buildLaneGrid, orderLanes, toShareTiers } from "../../src/features/tierlist/laneGrid.ts";
import { heroLanes } from "../../src/lib/heroPositions.ts";
import { parseTierData } from "../../src/features/tierlist/tierData.ts";

const hero = (id: string, lane: string, lanes?: string[]) => ({ id, name: id.toUpperCase(), icon: `https://x/${id}.png`, lane, lanes });
const laneOf = heroLanes as unknown as (h: { lane: string; lanes?: string[] }) => string[];
const build = (rows: { id: string; label: string; color?: string; heroes: ReturnType<typeof hero>[] }[], extra: { forceLane?: string | null; lanes?: string[] } = {}) =>
  buildLaneGrid(rows, { lanes: extra.lanes ?? orderLanes(), laneOf, forceLane: extra.forceLane });
const ids = (hs: { id: string }[]) => hs.map((h) => h.id);

test("lane order: canonical fallback, DB order when present", () => {
  assert.deepEqual(orderLanes(), [...DEFAULT_LANES]);
  assert.deepEqual(orderLanes([]), [...DEFAULT_LANES]);
  assert.deepEqual(orderLanes(["mid", "jungle"]), ["mid", "jungle", "slayer", "abyssal", "roaming"]);
  assert.deepEqual(orderLanes(["roaming", "nope", "slayer"]).slice(0, 2), ["roaming", "slayer"]);
});

test("one lane / multiple lanes / legacy fallback", () => {
  const g = build([{ id: "s", label: "S", heroes: [hero("a", "mid"), hero("b", "jungle", ["jungle", "slayer"]), hero("c", "abyssal", []), hero("d", "roaming", undefined)] }]);
  const c = g.rows[0].cells;
  assert.deepEqual(ids(c.mid), ["a"]);
  assert.deepEqual(ids(c.jungle), ["b"]);
  assert.deepEqual(ids(c.slayer), ["b"]);
  assert.deepEqual(ids(c.abyssal), ["c"]); // empty lanes[] -> legacy lane
  assert.deepEqual(ids(c.roaming), ["d"]); // missing lanes -> legacy lane
  assert.equal(g.hasUnassigned, false);
});

test("hero in several tiers shows in each (allowDuplicates), but never twice in one cell", () => {
  const data = parseTierData({ v: 2, dup: true, rows: [{ id: "s", label: "S", color: "#EF4444", heroes: ["a"] }, { id: "a", label: "A", color: "#F97316", heroes: ["a", "b"] }] });
  const byId = new Map([hero("a", "mid", ["mid", "jungle"]), hero("b", "mid")].map((h) => [h.id, h]));
  const rows = data.map((r) => ({ id: r.id, label: r.label, color: r.color, heroes: r.heroes.map((id) => byId.get(id)!) }));
  const g = build(rows);
  assert.deepEqual(ids(g.rows[0].cells.mid), ["a"]);
  assert.deepEqual(ids(g.rows[1].cells.mid), ["a", "b"]);
  assert.deepEqual(ids(g.rows[1].cells.jungle), ["a"]);
  // same hero object listed twice in one row, lanes repeated -> still once per cell
  const dup = hero("z", "mid", ["mid", "mid"]);
  const g2 = build([{ id: "s", label: "S", heroes: [dup, dup] }]);
  assert.deepEqual(ids(g2.rows[0].cells.mid), ["z"]);
});

test("custom row labels, colors and order are preserved; empty rows kept", () => {
  const rows = [
    { id: "r2", label: "Top", color: "#112233", heroes: [hero("a", "mid")] },
    { id: "r1", label: "Empty", color: "#445566", heroes: [] },
  ];
  const g = build(rows);
  assert.deepEqual(g.rows.map((r) => [r.id, r.label, r.color]), [["r2", "Top", "#112233"], ["r1", "Empty", "#445566"]]);
  assert.ok(Object.values(g.rows[1].cells).every((c) => c.length === 0));
});

test("unknown lane code is kept in `unassigned`, not dropped", () => {
  const g = build([{ id: "s", label: "S", heroes: [hero("a", "newlane"), hero("b", "mid")] }]);
  assert.deepEqual(ids(g.rows[0].unassigned), ["a"]);
  assert.equal(g.hasUnassigned, true);
  assert.ok(!Object.prototype.hasOwnProperty.call(g.rows[0].cells, OTHER_LANE));
});

test("lane filter: single column, every listed hero goes into it", () => {
  const g = build([{ id: "S", label: "S", heroes: [hero("a", "jungle"), hero("b", "mid", ["mid", "jungle"])] }], { forceLane: "jungle" });
  assert.deepEqual(g.lanes, ["jungle"]);
  assert.deepEqual(ids(g.rows[0].cells.jungle), ["a", "b"]);
  const g2 = build([{ id: "S", label: "S", heroes: [hero("a", "mid")] }], { forceLane: "jungle" }); // curated for that lane even if not tagged
  assert.deepEqual(ids(g2.rows[0].cells.jungle), ["a"]);
  assert.equal(g2.hasUnassigned, false);
});

test("building the grid does not mutate its input (Community snapshots stay intact)", () => {
  const rows = [{ id: "s", label: "S", color: "#EF4444", heroes: [hero("a", "mid", ["mid", "jungle"])] }];
  const before = JSON.stringify(rows);
  build(rows);
  assert.equal(JSON.stringify(rows), before);
});

test("share tiers carry exactly the web grid placements", () => {
  const g = build([{ id: "s", label: "S", color: "#EF4444", heroes: [hero("a", "mid", ["mid", "jungle"]), hero("b", "zzz")] }]);
  const t = toShareTiers(g);
  assert.equal(t.length, 1);
  assert.equal(t[0].tier, "S");
  assert.equal(t[0].color, "#EF4444");
  g.lanes.forEach((l, i) => assert.deepEqual(ids(t[0].cells[i]), ids(g.rows[0].cells[l]), l));
  assert.deepEqual(ids(t[0].unassigned), ["b"]);
});
