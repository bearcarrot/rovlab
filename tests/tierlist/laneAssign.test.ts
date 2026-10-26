import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_LANE_PLACEMENTS, dropRowFromLanes, laneHeroIds, laneRows, laneSig, laneTierOf, parseLanes, seedLanes, setLaneTier, type LaneAssign } from "../../src/features/tierlist/tierData.ts";
import { buildAssignedLaneGrid, laneCodesWith, orderLanes, toShareTiers } from "../../src/features/tierlist/laneGrid.ts";
import { emptyTierData, listSig, parseDraft, parseTierData, readLanes, serializeTierData, tierSig } from "../../src/features/tierlist/tierData.ts";
import { heroLanes } from "../../src/lib/heroPositions.ts";

const rows = emptyTierData(); // s-plus, s, a, b, c
const place = (l: LaneAssign | null, lane: string, id: string, row: string | null) => setLaneTier(l, rows, lane, id, row);
const hero = (id: string, lane: string, lanes?: string[]) => ({ id, name: id.toUpperCase(), icon: `https://x/${id}.png`, lane, lanes });

test("Astrid is S in Jungle and A in Slayer; changing one lane leaves the other", () => {
  let l = place(null, "jungle", "astrid", "s");
  l = place(l, "slayer", "astrid", "a");
  assert.equal(laneTierOf(l, "jungle", "astrid"), "s");
  assert.equal(laneTierOf(l, "slayer", "astrid"), "a");
  const before = JSON.stringify(l.slayer);
  l = place(l, "jungle", "astrid", "s-plus"); // move inside jungle
  assert.equal(laneTierOf(l, "jungle", "astrid"), "s-plus");
  assert.equal(JSON.stringify(l.slayer), before);
  assert.deepEqual(l.jungle, { "s-plus": ["astrid"] }); // moved, not copied: one Tier per hero per lane
});

test("any hero in any lane: no role/lane metadata is consulted, non-standard lane codes work", () => {
  const mage = hero("mage", "mid", ["mid"]);
  let l = place(null, "slayer", mage.id, "s"); // a mage that is not tagged slayer
  l = place(l, "custom-lane", mage.id, "c");
  assert.equal(laneTierOf(l, "slayer", "mage"), "s");
  assert.equal(laneTierOf(l, "custom-lane", "mage"), "c");
  assert.deepEqual(laneCodesWith(orderLanes(), l), [...orderLanes(), "custom-lane"]);
});

test("remove from one lane keeps the others; removing the last hero drops the empty lane", () => {
  let l = place(place(null, "jungle", "a", "s"), "slayer", "a", "b");
  l = place(l, "jungle", "a", null);
  assert.equal(laneTierOf(l, "jungle", "a"), null);
  assert.equal(laneTierOf(l, "slayer", "a"), "b");
  l = place(l, "slayer", "a", null);
  assert.deepEqual(l, {});
});

test("invalid targets and no-ops return the same object", () => {
  const l = place(null, "jungle", "a", "s");
  assert.equal(place(l, "jungle", "a", "s"), l);
  assert.equal(place(l, "jungle", "a", "nope"), l); // unknown row
  assert.equal(place(l, "BAD LANE", "a", "s"), l);
});

test("caps: placements and lanes", () => {
  let l: LaneAssign | null = null;
  for (let i = 0; i < MAX_LANE_PLACEMENTS + 5; i++) l = place(l, `l${i % 12}`, `h${i}`, "s");
  assert.equal(laneHeroIds(l).length, MAX_LANE_PLACEMENTS);
  assert.equal(place(l, "l99", "x", "s"), l);
});

test("parseLanes sanitizes: unknown rows, bad ids, repeats inside a lane, non-objects", () => {
  assert.equal(parseLanes(null, rows), null);
  assert.equal(parseLanes([], rows), null);
  const p = parseLanes({ jungle: { s: ["a", "a", 5, ""], zzz: ["q"], a: ["a", "b"] }, "Bad Lane": { s: ["x"] }, mid: "no" }, rows);
  assert.deepEqual(p, { jungle: { s: ["a"], a: ["b"] } }); // "a" first occurrence wins in row order
});

test("seedLanes copies a legacy board into the lanes of each hero, inventing nothing", () => {
  const board = parseTierData({ "S+": ["a"], S: ["b"], A: ["z"] });
  const byId = new Map([hero("a", "jungle", ["jungle", "slayer"]), hero("b", "mid"), hero("z", "newlane")].map((h) => [h.id, h]));
  const s = seedLanes(board, byId, heroLanes as never, orderLanes());
  assert.equal(laneTierOf(s, "jungle", "a"), "s-plus");
  assert.equal(laneTierOf(s, "slayer", "a"), "s-plus");
  assert.equal(laneTierOf(s, "mid", "b"), "s");
  assert.equal(laneHeroIds(s).includes("z"), false); // unknown lane: not placed anywhere
});

test("serialize/parse round trip keeps every lane placement; no lanes = exactly the old document", () => {
  const board = emptyTierData();
  assert.deepEqual(serializeTierData(board), { v: 2, rows: board });
  assert.deepEqual(serializeTierData(board, true, {}), { v: 2, rows: board, dup: true });
  const l = place(place(null, "jungle", "astrid", "s"), "slayer", "astrid", "a");
  const stored = JSON.parse(JSON.stringify(serializeTierData(board, false, l)));
  assert.deepEqual(readLanes(stored, parseTierData(stored)), l);
  // a row that no longer exists is dropped on save
  const without = serializeTierData(board.filter((r) => r.id !== "a"), false, l);
  assert.deepEqual(without.lanes, { jungle: { s: ["astrid"] } });
});

test("legacy documents and old drafts still load without lanes", () => {
  assert.equal(readLanes({ "S+": ["a"] }, parseTierData({ "S+": ["a"] })), null);
  assert.equal(parseDraft({ version: 1, name: "x", tiers: { S: ["a"] } })?.lanes, null);
  const d = parseDraft({ version: 2, name: "x", patch: "", tiers: serializeTierData(rows), lanes: { mid: { s: ["a"] } } });
  assert.deepEqual(d?.lanes, { mid: { s: ["a"] } });
});

test("unsaved-change signature: unchanged without lanes, changes with a lane edit", () => {
  const d = emptyTierData();
  assert.equal(listSig("My", d, false, laneSig(null)), JSON.stringify(["My", tierSig(d)]));
  assert.equal(listSig("My", d, true, ""), JSON.stringify(["My", tierSig(d), true]));
  assert.notEqual(listSig("My", d, false, laneSig(place(null, "mid", "a", "s"))), listSig("My", d, false, ""));
});

test("board edits never touch lanes; deleting a Tier row removes only its lane placements", () => {
  const l = place(place(null, "jungle", "a", "s"), "jungle", "b", "a");
  assert.deepEqual(dropRowFromLanes(l, "s"), { jungle: { a: ["b"] } });
  assert.equal(dropRowFromLanes(dropRowFromLanes(l, "s"), "a"), null);
});

test("assigned grid renders exactly the stored placements, same hero in several lanes with different Tiers", () => {
  let l = place(place(null, "jungle", "astrid", "s"), "slayer", "astrid", "a");
  l = place(l, "mid", "mage", "c");
  const byId = new Map(["astrid", "mage"].map((id) => [id, hero(id, "mid")]));
  const codes = laneCodesWith(orderLanes(), l);
  const g = buildAssignedLaneGrid(rows, l, byId, codes);
  const cell = (row: string, lane: string) => g.rows.find((r) => r.id === row)!.cells[lane].map((h) => h.id);
  assert.deepEqual(cell("s", "jungle"), ["astrid"]);
  assert.deepEqual(cell("a", "slayer"), ["astrid"]);
  assert.deepEqual(cell("c", "mid"), ["mage"]); // mage's own tag is mid; astrid's tags are irrelevant
  assert.deepEqual(cell("s", "slayer"), []);
  assert.equal(g.rows.length, rows.length); // empty rows kept
  // the PNG gets the same placements
  const t = toShareTiers(g);
  g.lanes.forEach((lane, i) => g.rows.forEach((r, k) => assert.deepEqual(t[k].cells[i].map((h) => h.id), r.cells[lane].map((h) => h.id))));
  assert.deepEqual(laneRows(l, rows, "jungle").find((r) => r.id === "s")?.heroes, ["astrid"]);
});
