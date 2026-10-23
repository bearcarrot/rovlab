import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_HEROES,
  addRow,
  collapseDuplicates,
  deleteRow,
  distinctHeroCount,
  duplicatePlacementCount,
  emptyTierData,
  findTier,
  findTiers,
  listSig,
  moveHero,
  parseDraft,
  parseTierData,
  placeHero,
  poolHeroes,
  readAllowDuplicates,
  removeFromRow,
  serializeTierData,
  shiftHero,
  tierHeroCount,
  tierSig,
} from "../../src/features/tierlist/tierData.ts";
import { buildCustomTierMap } from "../../src/features/draft/customTier.ts";
import { layout } from "../../src/lib/share-image/templates/tierLayout.ts";

const heroes = (d: ReturnType<typeof parseTierData>, id: string) => d.find((r) => r.id === id)!.heroes;
const row = (id: string, hs: string[]) => ({ id, label: id.toUpperCase(), color: "#112233", heroes: hs });

test("no setting stored = OFF: old documents and drafts keep one-hero-one-tier", () => {
  const stored = { v: 2, rows: [row("s", ["a", "b"]), row("a", ["b", "c"])] };
  assert.equal(readAllowDuplicates(stored), false);
  const d = parseTierData(stored);
  assert.deepEqual(heroes(d, "s"), ["a", "b"]);
  assert.deepEqual(heroes(d, "a"), ["c"]); // "b" already in an earlier row: dropped, exactly as before
  const draft = parseDraft({ version: 2, name: "x", patch: "", tiers: stored.rows });
  assert.equal(draft?.allowDuplicates, false);
  assert.equal(parseDraft({ version: 1, name: "x", tiers: { S: ["a"] } })?.allowDuplicates, false);
  assert.equal(readAllowDuplicates({ "S+": ["a"] }), false); // legacy fixed tiers
  assert.equal(readAllowDuplicates({ v: 2, rows: [], dup: "yes" }), false); // must be the boolean true
  assert.equal(readAllowDuplicates({ v: 2, rows: [], dup: false }), false);
  assert.equal(readAllowDuplicates(null), false);
});

test("OFF: placeHero behaves exactly like moveHero (hero leaves its previous row)", () => {
  let d = emptyTierData();
  d = placeHero(d, "h1", "s");
  d = placeHero(d, "h2", "s");
  d = placeHero(d, "h1", "a");
  assert.deepEqual(heroes(d, "s"), ["h2"]);
  assert.deepEqual(heroes(d, "a"), ["h1"]);
  assert.deepEqual(d, moveHero(moveHero(moveHero(emptyTierData(), "h1", "s"), "h2", "s"), "h1", "a"));
  assert.deepEqual(findTiers(d, "h1"), ["a"]);
  assert.equal(findTier(d, "h1"), "a");
});

test("ON: a hero can be in two rows and its first placement stays", () => {
  let d = emptyTierData();
  d = placeHero(d, "h1", "s", undefined, true);
  d = placeHero(d, "h1", "a", undefined, true);
  d = placeHero(d, "h1", "b", undefined, true);
  assert.deepEqual(findTiers(d, "h1"), ["s", "a", "b"]);
  assert.deepEqual(heroes(d, "s"), ["h1"]);
  assert.equal(tierHeroCount(d), 3);
  assert.equal(distinctHeroCount(d), 1);
  assert.equal(duplicatePlacementCount(d), 2);
  assert.equal(placeHero(d, "h1", "nope", undefined, true), d); // unknown row = no-op
});

test("ON: the hero stays available in the selection grid; OFF hides placed heroes", () => {
  const all = [{ id: "h1" }, { id: "h2" }, { id: "h3" }];
  const d = placeHero(emptyTierData(), "h1", "s", undefined, true);
  assert.deepEqual(poolHeroes(all, d, true).map((h) => h.id), ["h1", "h2", "h3"]);
  assert.deepEqual(poolHeroes(all, d, false).map((h) => h.id), ["h2", "h3"]);
  const removed = removeFromRow(d, "h1", "s");
  assert.deepEqual(poolHeroes(all, removed, false).map((h) => h.id), ["h1", "h2", "h3"]); // grid follows removals
});

test("ON: removing one placement keeps the others; removing a non-placement is a no-op", () => {
  let d = emptyTierData();
  for (const r of ["s", "a", "b"]) d = placeHero(d, "h1", r, undefined, true);
  d = placeHero(d, "h2", "a", undefined, true);
  const next = removeFromRow(d, "h1", "a");
  assert.deepEqual(findTiers(next, "h1"), ["s", "b"]);
  assert.deepEqual(heroes(next, "a"), ["h2"]);
  assert.equal(removeFromRow(next, "h1", "a"), next);
  assert.equal(removeFromRow(next, "zzz", "s"), next);
});

test("same hero can never be twice in one row (placeHero, parse, serialize)", () => {
  let d = placeHero(emptyTierData(), "h1", "s", undefined, true);
  assert.equal(placeHero(d, "h1", "s", undefined, true), d);
  d = placeHero(d, "h2", "s", undefined, true);
  d = placeHero(d, "h1", "s", 5, true); // with an index it is a reposition, not an add
  assert.deepEqual(heroes(d, "s"), ["h2", "h1"]);
  const parsed = parseTierData({ v: 2, dup: true, rows: [row("s", ["a", "a", "b"]), row("a", ["a"])] });
  assert.deepEqual(heroes(parsed, "s"), ["a", "b"]);
  assert.deepEqual(heroes(parsed, "a"), ["a"]);
  const out = serializeTierData([row("s", ["a", "a"])], true);
  assert.deepEqual(out.rows[0].heroes, ["a"]);
});

test("reordering inside a row (both modes) never duplicates", () => {
  let d = emptyTierData();
  for (const h of ["a", "b", "c"]) d = placeHero(d, h, "s", undefined, true);
  d = placeHero(d, "a", "b", undefined, true); // also in row b
  d = shiftHero(d, "a", 1, "s");
  assert.deepEqual(heroes(d, "s"), ["b", "a", "c"]);
  assert.deepEqual(heroes(d, "b"), ["a"]); // other placement untouched
  d = placeHero(d, "c", "s", 0, true);
  assert.deepEqual(heroes(d, "s"), ["c", "b", "a"]);
  assert.equal(shiftHero(d, "c", -1, "s"), d);
  assert.equal(shiftHero(d, "c", 1, "b"), d); // not in that row
  let off = emptyTierData();
  for (const h of ["a", "b", "c"]) off = moveHero(off, h, "s");
  off = shiftHero(off, "a", 1);
  assert.deepEqual(heroes(off, "s"), ["b", "a", "c"]);
});

test("row delete / edit keep the remaining rows valid in ON mode", () => {
  let d = emptyTierData();
  for (const r of ["s", "a"]) d = placeHero(d, "h1", r, undefined, true);
  d = deleteRow(d, "s");
  assert.deepEqual(findTiers(d, "h1"), ["a"]); // the other placement survives
  assert.equal(d.length, 4);
  d = addRow(d);
  assert.deepEqual(parseTierData(serializeTierData(d, true)), d);
});

test("setting survives local draft and cloud (jsonb) round trips; OFF output is unchanged", () => {
  let d = emptyTierData();
  for (const r of ["s", "a"]) d = placeHero(d, "h1", r, undefined, true);

  const cloud = JSON.parse(JSON.stringify(serializeTierData(d, true)));
  assert.equal(cloud.dup, true);
  assert.equal(readAllowDuplicates(cloud), true);
  assert.deepEqual(parseTierData(cloud), d); // default flag comes from the document itself

  const local = parseDraft(JSON.parse(JSON.stringify({ version: 2, name: "n", patch: "p", tiers: d, allowDuplicates: true })));
  assert.equal(local?.allowDuplicates, true);
  assert.deepEqual(local?.tiers, d);

  // copy / duplicate = parse + serialize again with the same flag
  assert.deepEqual(serializeTierData(parseTierData(cloud), readAllowDuplicates(cloud)), cloud);

  const off = serializeTierData(emptyTierData());
  assert.deepEqual(Object.keys(off).sort(), ["rows", "v"]); // no dup key: identical to the pre-existing shape
  assert.equal(JSON.stringify(serializeTierData(emptyTierData(), false)), JSON.stringify({ v: 2, rows: emptyTierData() }));
});

test("unsaved-change signature: OFF equals the old signature, toggling the setting changes it", () => {
  const d = emptyTierData();
  assert.equal(listSig(" My ", d, false), JSON.stringify(["My", tierSig(d)]));
  assert.notEqual(listSig("My", d, true), listSig("My", d, false));
});

test("validation: ON caps placements, OFF caps distinct heroes, ids/labels/colors unchanged", () => {
  const many = Array.from({ length: 150 }, (_, i) => `h${i}`);
  const on = parseTierData({ v: 2, dup: true, rows: [row("s", many), row("a", many)] });
  assert.equal(tierHeroCount(on), MAX_HEROES);
  let d = on;
  assert.equal(placeHero(d, "extra", "b", undefined, true), d); // full: a new placement is refused
  d = placeHero(d, "h0", "a", 0, true); // reposition of an existing placement still works when full
  assert.equal(tierHeroCount(d), MAX_HEROES);
  const off = parseTierData({ v: 2, rows: [row("s", many), row("a", many)] });
  assert.equal(tierHeroCount(off), 150);
  const bad = parseTierData({ v: 2, dup: true, rows: [{ id: "bad id!", label: "  ", color: "red", heroes: ["a", 3, ""] }] });
  assert.equal(bad[0].id, "r1");
  assert.equal(bad[0].label, "Tier");
  assert.equal(bad[0].color, "#64748B");
  assert.deepEqual(bad[0].heroes, ["a"]);
});

test("turning the setting OFF keeps each hero in its topmost row only", () => {
  let d = emptyTierData();
  for (const r of ["a", "s", "b"]) d = placeHero(d, "h1", r, undefined, true); // row order is s, a, b
  d = placeHero(d, "h2", "b", undefined, true);
  const c = collapseDuplicates(d);
  assert.deepEqual(findTiers(c, "h1"), ["s"]);
  assert.deepEqual(heroes(c, "b"), ["h2"]);
  assert.equal(duplicatePlacementCount(c), 0);
  assert.equal(collapseDuplicates(c), c); // nothing to remove: same array
});

test("Draft Assistant: a hero in several rows maps to the topmost row, deterministically", () => {
  let d = emptyTierData();
  for (const r of ["b", "a"]) d = placeHero(d, "h1", r, undefined, true);
  const map = buildCustomTierMap(d);
  assert.equal(map.get("h1")?.label, "A"); // row "a" is above row "b"
  assert.equal(buildCustomTierMap(d).get("h1")?.label, map.get("h1")?.label); // same input, same answer
  assert.equal(map.get("nobody"), undefined);
  const single = buildCustomTierMap(moveHero(emptyTierData(), "h9", "c"));
  assert.equal(single.get("h9")?.label, "C"); // normal lists unchanged
});

test("share image layout counts every placement of a repeated hero", () => {
  const rows = [{ heroes: ["h1", "h2"] }, { heroes: ["h1"] }, { heroes: ["h1", "h3"] }];
  const plan = layout(rows);
  assert.equal(plan.heights.length, 3);
  assert.equal(plan.fits, true);
  const full = layout(Array.from({ length: 20 }, () => ({ heroes: Array.from({ length: 10 }, (_, i) => `h${i}`) })));
  assert.equal(full.heights.length, 20);
  assert.equal(full.fits, true);
});
