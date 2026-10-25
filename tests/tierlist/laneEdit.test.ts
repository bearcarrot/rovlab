import { test } from "node:test";
import assert from "node:assert/strict";
import { moveLaneHero, removeLaneHero } from "../../src/features/tierlist/laneEdit.ts";

const rows = ["s", "a", "b"];

test("moving inside one lane leaves other lanes untouched", () => {
  const l = { jungle: { s: ["x"] }, slayer: { a: ["x"] } };
  const n = moveLaneHero(l, rows, "x", "jungle", "jungle", "b");
  assert.deepEqual(n.jungle, { b: ["x"] });
  assert.equal(n.slayer, l.slayer);
});

test("cross-lane move removes from the source lane only", () => {
  const l = { jungle: { s: ["x"] }, mid: { a: ["x", "y"] } };
  const n = moveLaneHero(l, rows, "x", "jungle", "slayer", "b");
  assert.equal(n.jungle, undefined);
  assert.deepEqual(n.slayer, { b: ["x"] });
  assert.deepEqual(n.mid, { a: ["x", "y"] });
});

test("cross-lane move onto a lane that already has the hero keeps one Tier per lane", () => {
  const l = { jungle: { s: ["x"] }, slayer: { a: ["x"] } };
  const n = moveLaneHero(l, rows, "x", "jungle", "slayer", "s");
  assert.deepEqual(n.slayer, { s: ["x"] });
  assert.equal(n.jungle, undefined);
});

test("adding from the picker (from=null) never removes it from another lane", () => {
  const l = { jungle: { s: ["x"] } };
  const n = moveLaneHero(l, rows, "x", null, "slayer", "a");
  assert.deepEqual(n, { jungle: { s: ["x"] }, slayer: { a: ["x"] } });
});

test("reorder: insert before an index, same cell", () => {
  const l = { mid: { s: ["a", "b", "c"] } };
  assert.deepEqual(moveLaneHero(l, rows, "c", "mid", "mid", "s", 0).mid, { s: ["c", "a", "b"] });
  assert.deepEqual(moveLaneHero(l, rows, "a", "mid", "mid", "s", 3).mid, { s: ["b", "c", "a"] });
});

test("no-ops and invalid targets return the same object", () => {
  const l = { mid: { s: ["a"] } };
  assert.equal(moveLaneHero(l, rows, "a", "mid", "mid", "s"), l);
  assert.equal(moveLaneHero(l, rows, "a", "mid", "mid", "nope"), l);
});

test("any hero can go to any lane: no role/lane metadata is involved", () => {
  assert.deepEqual(moveLaneHero(null, rows, "mage", null, "abyssal", "s"), { abyssal: { s: ["mage"] } });
});

test("removeLaneHero drops one lane only; last hero removes the empty lane", () => {
  const l = { jungle: { s: ["x"] }, slayer: { a: ["x"] } };
  const n = removeLaneHero(l, "jungle", "x");
  assert.deepEqual(n, { slayer: { a: ["x"] } });
  assert.equal(removeLaneHero(n, "jungle", "x"), n);
});

test("inputs are not mutated", () => {
  const l = { jungle: { s: ["x", "y"] }, mid: { a: ["x"] } };
  const before = JSON.stringify(l);
  moveLaneHero(l, rows, "x", "jungle", "mid", "b");
  removeLaneHero(l, "mid", "x");
  assert.equal(JSON.stringify(l), before);
});
