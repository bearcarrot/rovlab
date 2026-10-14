import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_HERO_GAMES,
  applyFilters,
  buildInsights,
  byHero,
  compare,
  kdaOf,
  sortHeroes,
  summarize,
  trends,
} from "../../src/features/matches/stats.ts";

// Run: node --experimental-strip-types --test tests/matches/analytics.test.ts  (Node >= 22.6, no extra deps)
let seq = 0;
const day = (n: number, month = 10) => `2026-${String(month).padStart(2, "0")}-${String(n).padStart(2, "0")}T20:00:00`;
const mk = (o: Record<string, unknown> = {}) =>
  ({
    id: `m${seq++}`, result: "victory", scoreBlue: 20, scoreRed: 10, durationSec: 900, playedAt: day(1), myTeam: "blue",
    myHeroId: "h1", myHeroName: "Zata", kills: 5, deaths: 2, assists: 5, gold: 10000, rating: 10, mvp: false,
    players: [], ocrEdited: false, createdAt: day(1), ...o,
  }) as never;
const mate = (o: Record<string, unknown> = {}) =>
  ({ team: "blue", hero: "X", heroId: null, kills: 3, deaths: 3, assists: 3, gold: 10000, rating: 10, mvp: false, isMe: false, ...o }) as never;
const series = (n: number, f: (i: number) => Record<string, unknown> = () => ({})) =>
  Array.from({ length: n }, (_, i) => mk({ playedAt: day(i + 1), ...f(i) }));
const anyOf = (x: any) => x as any;

test("empty history", () => {
  assert.equal(summarize([]), null);
  assert.deepEqual(trends([]).winRate, []);
  assert.equal(compare([]), null);
  assert.deepEqual(applyFilters([], { range: "last10", heroKey: null }), []);
});

test("single match: stats ok, a single game is never a win-rate trend", () => {
  const s = summarize([mk()])!;
  assert.equal(s.games, 1);
  assert.equal(s.winRate, 1);
  assert.equal(s.kda, 5); // (5+5)/2
  assert.deepEqual(trends([mk()]).winRate, []);
});

test("win rate", () => {
  assert.equal(summarize([mk(), mk(), mk(), mk({ result: "defeat" })])!.winRate, 0.75);
});

test("KDA with zero deaths divides by 1", () => {
  assert.equal(kdaOf(4, 0, 6), 10);
  assert.equal(summarize([mk({ kills: 4, deaths: 0, assists: 6 })])!.kda, 10);
});

test("non-finite values do not poison averages", () => {
  assert.equal(summarize([mk({ gold: NaN }), mk({ gold: 10000 })])!.avgGold, 10000);
});

test("rolling win rate needs a full window", () => {
  assert.equal(trends(series(10)).winRate.length, 1);
  assert.equal(trends(series(11)).winRate.length, 2);
});

test("hero grouping: id, else lower-cased name", () => {
  const lines = byHero([
    mk({ myHeroId: null, myHeroName: "Zata" }),
    mk({ myHeroId: null, myHeroName: "zata" }),
    mk({ myHeroId: "h2", myHeroName: "Airi" }),
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].key, "name:zata");
  assert.equal(lines[0].games, 2);
});

test("low-sample heroes sort last by win rate", () => {
  const a = { key: "a", heroId: "a", heroName: "A", games: 1, wins: 1, winRate: 1, kda: 9 };
  const b = { key: "b", heroId: "b", heroName: "B", games: MIN_HERO_GAMES, wins: 3, winRate: 0.6, kda: 3 };
  assert.deepEqual(sortHeroes([a, b], "winRate").map((h) => h.key), ["b", "a"]);
});

test("time-range filter uses recorded play time", () => {
  const now = new Date("2026-10-14T12:00:00").getTime();
  const ms = [mk({ playedAt: day(13) }), mk({ playedAt: day(5) }), mk({ playedAt: day(1, 9) })];
  assert.equal(applyFilters(ms, { range: "days7", heroKey: null }, now).length, 1);
  assert.equal(applyFilters(ms, { range: "days30", heroKey: null }, now).length, 2);
  assert.deepEqual(applyFilters([mk({ playedAt: "garbage" })], { range: "days30", heroKey: null }, now), []);
});

test("last-N returns the newest N and does not mutate the input", () => {
  const ms = series(12);
  const before = ms.map((m) => anyOf(m).id);
  const out = applyFilters(ms, { range: "last10", heroKey: null });
  assert.equal(out.length, 10);
  assert.equal(anyOf(out[0]).playedAt, day(12));
  assert.deepEqual(ms.map((m) => anyOf(m).id), before);
});

test("hero filter is applied before last-N", () => {
  const ms = [...series(5, () => ({ myHeroId: "h2" })), ...series(3).map((m, i) => ({ ...anyOf(m), playedAt: day(10 + i) }) as never)];
  assert.equal(applyFilters(ms, { range: "last10", heroKey: "h2" }).length, 5);
});

test("compare: insufficient history returns null", () => {
  assert.equal(compare(series(19)), null);
});

test("compare: latest 10 vs previous 10, zero denominators are safe", () => {
  const c = compare(series(20, (i) => ({ result: i < 10 ? "defeat" : "victory" })))!;
  assert.equal(c.recent.winRate, 1);
  assert.equal(c.previous.winRate, 0);
  assert.equal(c.winRate.diff, 1);
  assert.equal(c.winRate.pct, null); // previous is 0 -> no percentage
  const z = compare(series(20, (i) => ({ deaths: i < 10 ? 0 : 2 })))!;
  assert.equal(z.deaths.diff, 2);
  assert.equal(z.deaths.pct, null);
  assert.ok(Number.isFinite(z.kda.current));
});

test("insights: too little data or no teammate rows -> nothing", () => {
  assert.deepEqual(buildInsights([mk({ players: [mate()] }), mk({ players: [mate()] })]), []);
  assert.deepEqual(buildInsights(series(5)), []);
});

test("insights use only the matches given and state the sample size", () => {
  const a = series(6, () => ({ myHeroId: "A", deaths: 8, players: [mate({ deaths: 2 }), mate({ deaths: 2 })] }));
  const b = series(6, () => ({ myHeroId: "B", deaths: 2, players: [mate({ deaths: 2 }), mate({ deaths: 2 })] }));
  const all = [...a, ...b];
  const onlyA = buildInsights(applyFilters(all, { range: "all", heroKey: "A" }), Infinity);
  const onlyB = buildInsights(applyFilters(all, { range: "all", heroKey: "B" }), Infinity);
  const high = onlyA.find((i) => i.id === "deaths-high");
  assert.ok(high);
  assert.ok(high.detail.includes("6 แมตช์"));
  assert.ok(high.suggestion); // advice kept apart from the measured fact
  assert.equal(onlyB.find((i) => i.id.startsWith("deaths")), undefined);
});

test("insights skip kill participation when K+A exceeds the team score", () => {
  const bad = series(5, () => ({ kills: 20, assists: 10, scoreBlue: 20, players: [mate()] }));
  assert.equal(buildInsights(bad).find((i) => i.id.startsWith("kp")), undefined);
});
