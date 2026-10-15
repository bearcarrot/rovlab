import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_HEROES,
  MAX_ROWS,
  addRow,
  deleteRow,
  emptyTierData,
  findTier,
  moveHero,
  moveRow,
  parseDraft,
  parseTierData,
  rowsCustomized,
  serializeTierData,
  shiftHero,
  tierHeroCount,
  tierSig,
  updateRow,
} from "../../src/features/tierlist/tierData.ts";

const ids = (d: ReturnType<typeof parseTierData>) => d.map((r) => r.id);
const heroes = (d: ReturnType<typeof parseTierData>, id: string) => d.find((r) => r.id === id)!.heroes;

test("legacy fixed-tier data migrates to five default rows with hero order intact", () => {
  const d = parseTierData({ "S+": ["a", "b"], S: ["c"], A: [], B: ["d", "e", "f"] });
  assert.deepEqual(d.map((r) => r.label), ["S+", "S", "A", "B", "C"]);
  assert.deepEqual(ids(d), ["s-plus", "s", "a", "b", "c"]);
  assert.deepEqual(heroes(d, "s-plus"), ["a", "b"]);
  assert.deepEqual(heroes(d, "b"), ["d", "e", "f"]);
  assert.deepEqual(heroes(d, "c"), []);
  assert.equal(d[0].color, "#DC2626");
  assert.deepEqual(parseTierData({}), emptyTierData());
});

test("garbage input never throws and falls back to the default rows", () => {
  for (const bad of [null, undefined, 5, "x", true]) assert.deepEqual(parseTierData(bad), emptyTierData());
  assert.deepEqual(parseTierData({ v: 2, rows: "nope" }).map((r) => r.id), ["s-plus", "s", "a", "b", "c"]);
  assert.deepEqual(parseTierData({ v: 2, rows: [] }), emptyTierData());
});

test("v2 round trip keeps custom rows, order, colors and empty rows", () => {
  const rows = [
    { id: "x1", label: "SS", color: "#112233", heroes: ["a"] },
    { id: "x2", label: "Meta", color: "#abcdef", heroes: [] },
  ];
  const back = parseTierData(JSON.parse(JSON.stringify(serializeTierData(rows))));
  assert.deepEqual(back, [
    { id: "x1", label: "SS", color: "#112233", heroes: ["a"] },
    { id: "x2", label: "Meta", color: "#ABCDEF", heroes: [] },
  ]);
  assert.equal(serializeTierData(rows).v, 2);
});

test("validation: labels, colors, ids, duplicates, caps", () => {
  const d = parseTierData({
    v: 2,
    rows: [
      { id: "bad id!", label: "   ", color: "red", heroes: ["a", "a", "", 3, "b"] },
      { id: "dup", label: "A very long tier label indeed", color: "#00ff00", heroes: ["b", "c"] },
      { id: "dup", label: "Z", color: "#00ff00", heroes: [] },
      null,
      "junk",
    ],
  });
  assert.equal(d.length, 3);
  assert.deepEqual(ids(d), ["r1", "dup", "r2"]); // invalid / duplicate ids are replaced
  assert.equal(d[0].label, "Tier");
  assert.equal(d[0].color, "#64748B");
  assert.equal(d[1].label.length, 12);
  assert.deepEqual(d[0].heroes, ["a", "b"]);
  assert.deepEqual(d[1].heroes, ["c"]); // "b" already placed in an earlier row: no duplicate across the board

  const many = parseTierData({ v: 2, rows: Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, label: "T", color: "#000000", heroes: [] })) });
  assert.equal(many.length, MAX_ROWS);
  const lots = parseTierData({ v: 2, rows: [{ id: "a", label: "A", color: "#000000", heroes: Array.from({ length: 500 }, (_, i) => `h${i}`) }] });
  assert.equal(tierHeroCount(lots), MAX_HEROES);
});

test("moveHero keeps a hero in exactly one row; null returns it to the pool; unknown row is a no-op", () => {
  let d = emptyTierData();
  d = moveHero(d, "h1", "s");
  d = moveHero(d, "h2", "s");
  d = moveHero(d, "h1", "a");
  assert.deepEqual(heroes(d, "s"), ["h2"]);
  assert.deepEqual(heroes(d, "a"), ["h1"]);
  assert.equal(findTier(d, "h1"), "a");
  d = moveHero(d, "h3", "s", 0);
  assert.deepEqual(heroes(d, "s"), ["h3", "h2"]);
  assert.equal(moveHero(d, "h1", "nope"), d);
  d = moveHero(d, "h1", null);
  assert.equal(findTier(d, "h1"), null);
  assert.equal(tierHeroCount(d), 2);
});

test("shiftHero swaps inside the row and stops at the ends", () => {
  let d = emptyTierData();
  for (const h of ["a", "b", "c"]) d = moveHero(d, h, "s");
  d = shiftHero(d, "a", 1);
  assert.deepEqual(heroes(d, "s"), ["b", "a", "c"]);
  assert.equal(shiftHero(d, "b", -1), d);
  assert.equal(shiftHero(d, "zzz", 1), d);
});

test("row create / edit / reorder / delete", () => {
  let d = emptyTierData();
  d = moveHero(d, "h1", "a");
  d = addRow(d);
  assert.equal(d.length, 6);
  const added = d[5];
  assert.equal(new Set(ids(d)).size, 6);
  d = updateRow(d, added.id, { label: " SS ", color: "#123456" });
  assert.equal(d[5].label, "SS");
  assert.equal(d[5].color, "#123456");
  d = updateRow(d, added.id, { label: "   ", color: "nope" }); // invalid edits are ignored
  assert.equal(d[5].label, "SS");
  assert.equal(d[5].color, "#123456");
  d = moveRow(d, added.id, -1);
  assert.equal(d[4].id, added.id);
  assert.equal(moveRow(d, d[0].id, -1), d);
  // deleting a row with heroes puts them back in the pool (no longer placed anywhere)
  d = deleteRow(d, "a");
  assert.equal(findTier(d, "h1"), null);
  assert.equal(d.length, 5);
  // cannot go below one row, cannot exceed the cap
  assert.equal(deleteRow([d[0]], d[0].id).length, 1);
  let full = emptyTierData();
  for (let i = 0; i < 40; i++) full = addRow(full);
  assert.equal(full.length, MAX_ROWS);
  assert.equal(new Set(ids(full)).size, MAX_ROWS);
});

test("dirty-state signature covers ids, labels, colors, order and placement", () => {
  const base = emptyTierData();
  const sig = tierSig(base);
  assert.equal(tierSig(emptyTierData()), sig);
  assert.notEqual(tierSig(updateRow(base, "s", { label: "SS" })), sig);
  assert.notEqual(tierSig(updateRow(base, "s", { color: "#000000" })), sig);
  assert.notEqual(tierSig(moveRow(base, "s", 1)), sig);
  assert.notEqual(tierSig(addRow(base)), sig);
  assert.notEqual(tierSig(deleteRow(base, "c")), sig);
  assert.notEqual(tierSig(moveHero(base, "h", "s")), sig);
});

test("rowsCustomized: default rows are pristine, any row change is not", () => {
  assert.equal(rowsCustomized(emptyTierData()), false);
  assert.equal(rowsCustomized(moveHero(emptyTierData(), "h", "s")), false); // heroes are counted separately
  assert.equal(rowsCustomized(updateRow(emptyTierData(), "a", { label: "A+" })), true);
  assert.equal(rowsCustomized(addRow(emptyTierData())), true);
  assert.equal(rowsCustomized(deleteRow(emptyTierData(), "b")), true);
});

test("local draft recovery: legacy v1, v2, and malformed data", () => {
  const legacy = parseDraft({ version: 1, name: "Old", patch: "1.2", tiers: { "S+": ["a"], S: ["b"], A: [], B: [], C: [] } });
  assert.equal(legacy?.name, "Old");
  assert.deepEqual(heroes(legacy!.tiers, "s-plus"), ["a"]);
  const v2 = parseDraft({ version: 2, name: "New", patch: "", tiers: [{ id: "q", label: "Q", color: "#010203", heroes: ["z"] }] });
  assert.deepEqual(v2?.tiers, [{ id: "q", label: "Q", color: "#010203", heroes: ["z"] }]);
  assert.equal(parseDraft({ version: 3, name: "x", tiers: {} }), null);
  assert.equal(parseDraft({ version: 2, tiers: [] }), null);
  assert.equal(parseDraft({ version: 2, name: "x" }), null);
  assert.equal(parseDraft("{"), null);
  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft({ version: 2, name: "x".repeat(100), tiers: [] })?.name.length, 40);
});

test("save/load round trip keeps the signature (not dirty after reopening)", () => {
  let d = emptyTierData();
  d = updateRow(addRow(d), "r1", { label: "Meta", color: "#ABCDEF" });
  d = moveHero(d, "h1", "r1");
  d = moveRow(moveRow(d, "r1", -1), "r1", -1);
  const reopened = parseTierData(JSON.parse(JSON.stringify(serializeTierData(d))));
  assert.equal(tierSig(reopened), tierSig(d));
});
