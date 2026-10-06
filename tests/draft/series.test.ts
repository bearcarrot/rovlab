import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSeries, setPickAt, addBan, resetGame, resetSeries, getGlobalRestrictedHeroes,
  getAvailableHeroes, findRestrictionConflicts, type DraftSeries, type TeamKey,
} from "../../src/features/draft/series.ts";

// Run: node --experimental-strip-types --test tests/draft/series.test.ts  (Node >= 22.6, no extra deps)
const heroes = "ABCDEFGHIJKLMNOP".split("").map((slug) => ({ slug }));
const pickAll = (s: DraftSeries, g: number, t: TeamKey, hs: string[]) =>
  hs.reduce((acc, h, i) => setPickAt(acc, g, t, i, h), s);
const avail = (s: DraftSeries, g: number, t: TeamKey) =>
  new Set(getAvailableHeroes({ heroes, series: s, gameNumber: g, team: t }).map((h) => h.slug));

test("T1 game 1: nothing restricted", () => {
  const s = createSeries("bo5");
  assert.equal(avail(s, 1, "mine").size, heroes.length);
  assert.equal(avail(s, 1, "enemy").size, heroes.length);
});

test("T2 same team restriction only", () => {
  let s = pickAll(createSeries("bo5"), 1, "mine", ["A"]);
  assert.equal(avail(s, 2, "mine").has("A"), false);
  assert.equal(avail(s, 2, "enemy").has("A"), true);
});

test("T3 opponent pick restricts only the opponent", () => {
  const s = pickAll(createSeries("bo5"), 1, "enemy", ["A"]);
  assert.equal(avail(s, 2, "mine").has("A"), true);
  assert.equal(avail(s, 2, "enemy").has("A"), false);
});

test("T4 ban does not create global restriction (but bans within the game)", () => {
  const s = addBan(createSeries("bo5"), 1, "mine", "A");
  assert.equal(avail(s, 1, "mine").has("A"), false);
  assert.equal(avail(s, 1, "enemy").has("A"), false);
  assert.equal(avail(s, 2, "mine").has("A"), true);
});

test("T5 restrictions accumulate across games", () => {
  let s = pickAll(createSeries("bo5"), 1, "mine", ["A", "B", "C", "D", "E"]);
  s = pickAll(s, 2, "mine", ["F", "G", "H", "I", "J"]);
  const r = getGlobalRestrictedHeroes({ series: s, gameNumber: 3, team: "mine" });
  assert.deepEqual([...r].sort(), "ABCDEFGHIJ".split(""));
  assert.equal(getGlobalRestrictedHeroes({ series: s, gameNumber: 3, team: "enemy" }).size, 0);
});

test("T6 reset game keeps history, recomputes later restrictions", () => {
  let s = pickAll(createSeries("bo5"), 1, "mine", ["A"]);
  s = pickAll(s, 2, "mine", ["B"]);
  assert.equal(avail(s, 3, "mine").has("B"), false);
  s = resetGame(s, 2);
  assert.equal(avail(s, 3, "mine").has("A"), false); // game 1 intact
  assert.equal(avail(s, 3, "mine").has("B"), true); // game 2 cleared
});

test("same-game duplicate across teams stays blocked (existing behaviour)", () => {
  const s = pickAll(createSeries("single"), 1, "mine", ["A"]);
  assert.equal(avail(s, 1, "enemy").has("A"), false);
});

test("single / GBP off: no global history", () => {
  const single = pickAll(createSeries("single"), 1, "mine", ["A"]);
  assert.equal(getGlobalRestrictedHeroes({ series: single, gameNumber: 2, team: "mine" }).size, 0);
  const off = pickAll(createSeries("bo3", { globalBanPick: false }), 1, "mine", ["A"]);
  assert.equal(avail(off, 2, "mine").has("A"), true);
});

test("bo7 game 7 rule is configurable, not hard-coded", () => {
  const base = createSeries("bo7", { game7Rule: "normal" });
  const s = pickAll(base, 1, "mine", ["A"]);
  assert.equal(avail(s, 6, "mine").has("A"), false);
  assert.equal(avail(s, 7, "mine").has("A"), true); // normal => pool resets
  assert.equal(avail({ ...s, game7Rule: "global" }, 7, "mine").has("A"), false);
});

test("editing an earlier game surfaces conflicts instead of deleting data", () => {
  let s = pickAll(createSeries("bo3"), 2, "mine", ["A"]);
  assert.equal(findRestrictionConflicts(s).length, 0);
  s = pickAll(s, 1, "mine", ["A"]);
  assert.deepEqual(findRestrictionConflicts(s), [{ gameNumber: 2, team: "mine", hero: "A" }]);
});

test("reset series clears all games and keeps config", () => {
  const s = resetSeries(pickAll(createSeries("bo5"), 1, "mine", ["A"]));
  assert.equal(s.format, "bo5");
  assert.equal(s.globalBanPick, true);
  assert.equal(s.games.every((g) => g.mine.picks.every((p) => p === null)), true);
});
