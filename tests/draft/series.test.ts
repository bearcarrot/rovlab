import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSeries, setPickAt, addBan, resetGame, resetSeries, getGlobalRestrictedHeroes,
  getAvailableHeroes, findRestrictionConflicts, parseSeries, changeFormat, droppedGameCount, legacyTeams, MAX_BANS,
  type DraftSeries, type TeamKey,
} from "../../src/features/draft/series.ts";
import { timeAgo, copyName } from "../../src/features/community/format.ts";
import { nextReaction, applyReaction, toReaction } from "../../src/features/community/reactions.ts";
import { parseTierData, tierHeroCount } from "../../src/features/tierlist/tierData.ts";

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

test("parseSeries rejects garbage and repairs bad shapes", () => {
  assert.equal(parseSeries(null), null);
  assert.equal(parseSeries("x"), null);
  assert.equal(parseSeries({ format: "bo9" }), null);
  const s = parseSeries({
    format: "bo3", globalBanPick: true, game7Rule: "nope",
    games: [{ mine: { picks: ["a", "a", 5, "b"], bans: ["x", "x", "y"] }, enemy: "bad" }, null, { mine: { picks: "no" } }, { extra: 1 }],
  })!;
  assert.equal(s.games.length, 3); // clamped to the format
  assert.equal(s.game7Rule, "normal");
  assert.deepEqual(s.games[0].mine.picks, ["a", null, null, "b", null]); // dup + non-string dropped
  assert.deepEqual(s.games[0].mine.bans, ["x", "y"]);
  assert.deepEqual(s.games[0].enemy, { bans: [], picks: [null, null, null, null, null] });
  const many = parseSeries({ format: "single", games: [{ mine: { bans: Array.from({ length: 20 }, (_, i) => "h" + i) } }] })!;
  assert.equal(many.games[0].mine.bans.length, MAX_BANS);
  assert.equal(parseSeries({ format: "single", globalBanPick: true })!.globalBanPick, false); // single never uses global BP
});

test("parseSeries round-trips a JSON-serialised series", () => {
  const s = pickAll(createSeries("bo5"), 2, "enemy", ["A", "B"]);
  assert.deepEqual(parseSeries(JSON.parse(JSON.stringify(s))), s);
});

test("changeFormat keeps games, turns GBP on from single, warns about dropped games", () => {
  let s = pickAll(createSeries("single"), 1, "mine", ["A"]);
  s = changeFormat(s, "bo5");
  assert.equal(s.games.length, 5);
  assert.equal(s.globalBanPick, true);
  assert.equal(s.games[0].mine.picks[0], "A");
  s = pickAll(s, 4, "mine", ["B"]);
  assert.equal(droppedGameCount(s, "bo3"), 1);
  assert.equal(droppedGameCount(s, "bo7"), 0);
  assert.equal(changeFormat(s, "bo3").games.length, 3);
  assert.equal(changeFormat(changeFormat(s, "bo3"), "bo5").globalBanPick, true);
});

test("legacyTeams returns game 1 picks without empty slots", () => {
  const s = pickAll(pickAll(createSeries("bo3"), 1, "mine", ["A", "B"]), 2, "mine", ["C"]);
  assert.deepEqual(legacyTeams(s), { myTeam: ["A", "B"], enemyTeam: [] });
});

test("timeAgo / copyName", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  assert.equal(timeAgo("2026-10-06T11:59:50Z", now), "เมื่อสักครู่");
  assert.equal(timeAgo("2026-10-06T11:55:00Z", now), "5 นาทีที่แล้ว");
  assert.equal(timeAgo("2026-10-06T09:00:00Z", now), "3 ชั่วโมงที่แล้ว");
  assert.equal(timeAgo("2026-10-04T12:00:00Z", now), "2 วันที่แล้ว");
  assert.equal(timeAgo("garbage", now), "");
  assert.equal(copyName("Top Server", 40), "Top Server (Copy)");
  assert.equal(copyName("x".repeat(60), 40).length, 40);
  assert.ok(copyName("x".repeat(60), 40).endsWith(" (Copy)"));
  assert.equal(copyName("   ", 40), "Untitled (Copy)");
});

test("reactions: one state per user, toggling and switching", () => {
  assert.equal(nextReaction(0, 1), 1);
  assert.equal(nextReaction(1, 1), 0); // like again => none
  assert.equal(nextReaction(1, -1), -1); // like -> dislike
  assert.equal(nextReaction(-1, 1), 1);
  assert.equal(toReaction("x"), 0);
  let c = { likes: 3, dislikes: 1 };
  c = applyReaction(c, 0, 1); assert.deepEqual(c, { likes: 4, dislikes: 1 });
  c = applyReaction(c, 1, -1); assert.deepEqual(c, { likes: 3, dislikes: 2 });
  c = applyReaction(c, -1, 0); assert.deepEqual(c, { likes: 3, dislikes: 1 });
  assert.deepEqual(applyReaction({ likes: 0, dislikes: 0 }, 1, 0), { likes: 0, dislikes: 0 }); // never negative
});

test("parseTierData keeps known tiers, strings only, each hero once", () => {
  const d = parseTierData({ "S+": ["a", "b", 3, ""], S: ["a", "c"], Z: ["z"], A: "nope", B: [null, "d"], C: ["x".repeat(65)] });
  assert.deepEqual(d, { "S+": ["a", "b"], S: ["c"], A: [], B: ["d"], C: [] });
  assert.equal(tierHeroCount(d), 4);
  assert.deepEqual(parseTierData(null), { "S+": [], S: [], A: [], B: [], C: [] });
  assert.deepEqual(parseTierData("x"), { "S+": [], S: [], A: [], B: [], C: [] });
  const many = parseTierData({ A: Array.from({ length: 500 }, (_, i) => "h" + i) });
  assert.equal(tierHeroCount(many), 200);
});
