import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDuplicate } from "../../src/features/matches/duplicate.ts";

// Run: node --experimental-strip-types --test tests/matches/duplicate.test.ts  (Node >= 22.6, no extra deps)
const player = (i: number, over: Record<string, unknown> = {}) => ({
  team: i < 5 ? "blue" : "red", hero: `H${i}`, hero_id: `id${i}`, kills: i, deaths: 1, assists: 2, gold: 5000 + i, rating: 7.5, mvp: i === 0, is_me: i === 0, ...over,
});
const mk = (over: Record<string, unknown> = {}, players = Array.from({ length: 10 }, (_, i) => player(i))) =>
  ({ user_id: "u", result: "victory", score_blue: 10, score_red: 5, duration_sec: 800, played_at: "2026-10-10 13:45:00", players, ...over }) as never;
// a saved row as MatchRecord (camelCase, ISO "T" time, rating possibly a different float repr)
const rec = (row: any, over: Record<string, unknown> = {}) => ({
  id: "m1", result: row.result, scoreBlue: row.score_blue, scoreRed: row.score_red, durationSec: row.duration_sec,
  playedAt: row.played_at.replace(" ", "T"),
  players: row.players.map((p: any) => ({ team: p.team, hero: p.hero, heroId: p.hero_id, kills: p.kills, deaths: p.deaths, assists: p.assists, gold: p.gold, rating: p.rating, mvp: p.mvp, isMe: p.is_me })),
  ...over,
}) as never;

test("exact duplicate, player row order ignored", () => {
  const a = mk();
  const saved = rec(mk({}, Array.from({ length: 10 }, (_, i) => player(i)).reverse()));
  const r = checkDuplicate(a, [saved]);
  assert.equal(r.status, "DUPLICATE");
  assert.equal((r.existing as any).id, "m1");
});

test("one reliable field differs => NOT_DUPLICATE (each field)", () => {
  const saved = rec(mk());
  for (const over of [{ result: "defeat" }, { score_blue: 11 }, { score_red: 6 }, { played_at: "2026-10-10 13:46:00" }]) {
    assert.equal(checkDuplicate(mk(over), [saved]).status, "NOT_DUPLICATE");
  }
  const edit = (f: string, v: unknown) => checkDuplicate(mk({}, Array.from({ length: 10 }, (_, i) => player(i, i === 7 ? { [f]: v } : {}))), [saved]).status;
  for (const [f, v] of [["kills", 99], ["deaths", 9], ["assists", 9], ["gold", 1], ["rating", 8.1], ["mvp", true], ["hero_id", "other"]] as const) {
    assert.equal(edit(f, v), "NOT_DUPLICATE", f);
  }
});

test("same hero swapped between teams is a different match", () => {
  const ps = Array.from({ length: 10 }, (_, i) => player(i));
  const swapped = ps.map((p, i) => (i === 1 ? { ...p, team: "red" } : i === 6 ? { ...p, team: "blue" } : p));
  assert.equal(checkDuplicate(mk({}, swapped), [rec(mk())]).status, "NOT_DUPLICATE");
});

test("no saved match with that time + length => NOT_DUPLICATE without existing", () => {
  assert.deepEqual(checkDuplicate(mk(), []), { status: "NOT_DUPLICATE", existing: undefined });
});

test("missing / ambiguous data never becomes DUPLICATE", () => {
  const saved = rec(mk());
  const unresolved = mk({}, Array.from({ length: 10 }, (_, i) => player(i, i === 3 ? { hero_id: null } : {})));
  assert.equal(checkDuplicate(unresolved, [rec(unresolved)]).status, "INDETERMINATE"); // identical, but a hero is unknown
  assert.equal(checkDuplicate(mk({ result: "" }), [saved]).status, "INDETERMINATE");
  assert.equal(checkDuplicate(mk({ score_blue: NaN }), [saved]).status, "INDETERMINATE");
  assert.equal(checkDuplicate(mk({ played_at: "garbage" }), [saved]).status, "INDETERMINATE");
  assert.equal(checkDuplicate(mk({}, Array.from({ length: 9 }, (_, i) => player(i))), [saved]).status, "INDETERMINATE");
  assert.equal(checkDuplicate(mk({}, Array.from({ length: 10 }, (_, i) => player(i, i === 2 ? { mvp: undefined } : {}))), [saved]).status, "INDETERMINATE");
  // unknown hero + a reliable difference elsewhere is still a reliable NOT_DUPLICATE
  assert.equal(checkDuplicate(mk({ score_red: 6 }, unresolved.players), [rec(unresolved)]).status, "NOT_DUPLICATE");
});

test("rating float noise and 'T' vs space in time do not matter", () => {
  const saved = rec(mk(), { playedAt: "2026-10-10T13:45:00" });
  const a = mk({}, Array.from({ length: 10 }, (_, i) => player(i, { rating: 7.5000001 })));
  assert.equal(checkDuplicate(a, [saved]).status, "DUPLICATE");
});

test("checking never mutates its inputs", () => {
  const a = mk(); const s = rec(mk());
  const before = JSON.stringify([a, s]);
  checkDuplicate(a, [s]);
  assert.equal(JSON.stringify([a, s]), before);
});
