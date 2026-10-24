import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentTurn, isTurnAllowed, turnTarget, makeDeadline, secondsLeft, BAN_SECONDS, PICK_SECONDS,
  type CurrentTurn,
} from "../../src/features/draft/competitive.ts";
import {
  createSeries, addBan, setPickAt, getAvailableHeroes, getGame, type DraftGame, type DraftSeries, type TeamKey,
} from "../../src/features/draft/series.ts";

// Run: node --experimental-strip-types --test tests/draft/competitive.test.ts
const heroes = Array.from({ length: 30 }, (_, i) => ({ slug: `h${i}` }));

/** Plays the whole draft the way a user would (first available hero each time), recording every action. */
function play(first: TeamKey, stopAfter = Infinity) {
  let s: DraftSeries = createSeries("single");
  const log: { phase: number; team: TeamKey; kind: string }[] = [];
  const game = () => getGame(s, 1) as DraftGame;
  for (let n = 0; n < stopAfter; n++) {
    const turn = getCurrentTurn(game(), first);
    if (!turn) break;
    const hero = getAvailableHeroes({ heroes, series: s, gameNumber: 1, team: turn.team })[0].slug;
    if (turn.kind === "ban") s = addBan(s, 1, turn.team, hero);
    else {
      const t = turnTarget(game(), turn);
      assert.equal(t.kind, "pick");
      s = setPickAt(s, 1, turn.team, (t as { index: number }).index, hero);
    }
    log.push({ phase: turn.phase, team: turn.team, kind: turn.kind });
  }
  return { s, log, game: game() };
}

const seq = (log: ReturnType<typeof play>["log"], phase: number) =>
  log.filter((l) => l.phase === phase).map((l) => l.team);

test("T1 ban phase 1 alternates first/second until two bans each", () => {
  const { log } = play("mine");
  assert.deepEqual(seq(log, 1), ["mine", "enemy", "mine", "enemy"]);
  assert.ok(log.filter((l) => l.phase === 1).every((l) => l.kind === "ban"));
});

test("T2 pick phase 1: first 1, second 2, first 2, second 1", () => {
  assert.deepEqual(seq(play("mine").log, 2), ["mine", "enemy", "enemy", "mine", "mine", "enemy"]);
});

test("T3 ban phase 2 alternates again", () => {
  assert.deepEqual(seq(play("mine").log, 3), ["mine", "enemy", "mine", "enemy"]);
});

test("T4 pick phase 2: second 1, first 2, second 1", () => {
  assert.deepEqual(seq(play("mine").log, 4), ["enemy", "mine", "mine", "enemy"]);
});

test("T5 finished draft: 5 picks and 4 bans per team, then no turn", () => {
  const { game, log } = play("enemy");
  for (const t of ["mine", "enemy"] as const) {
    assert.equal(game[t].picks.filter(Boolean).length, 5);
    assert.equal(game[t].bans.length, 4);
  }
  assert.equal(log.length, 18); // 8 bans + 10 picks
  assert.equal(getCurrentTurn(game, "enemy"), null);
  assert.equal(new Set([...game.mine.picks, ...game.enemy.picks, ...game.mine.bans, ...game.enemy.bans]).size, 18);
});

test("T6 a two-pick turn stays active after one pick and ends after two", () => {
  const start = play("mine", 5).game; // 4 bans + first pick done -> second pick's 2-pick turn
  const t0 = getCurrentTurn(start, "mine") as CurrentTurn;
  assert.deepEqual([t0.team, t0.kind, t0.left], ["enemy", "pick", 2]);
  const one = play("mine", 6);
  const t1 = getCurrentTurn(one.game, "mine") as CurrentTurn;
  assert.equal(t1.index, t0.index);
  assert.deepEqual([t1.team, t1.left], ["enemy", 1]);
  const two = getCurrentTurn(play("mine", 7).game, "mine") as CurrentTurn;
  assert.notEqual(two.index, t0.index);
  assert.equal(two.team, "mine");
});

test("T7 banned/picked heroes leave the pool; wrong team or kind is not allowed", () => {
  let s = addBan(createSeries("single"), 1, "mine", "h0");
  s = setPickAt(s, 1, "enemy", 0, "h1");
  for (const team of ["mine", "enemy"] as const) {
    const pool = getAvailableHeroes({ heroes, series: s, gameNumber: 1, team }).map((h) => h.slug);
    assert.ok(!pool.includes("h0") && !pool.includes("h1"));
  }
  const turn = getCurrentTurn(getGame(createSeries("single"), 1) as DraftGame, "mine");
  assert.equal(isTurnAllowed(turn, "mine", "ban"), true);
  assert.equal(isTurnAllowed(turn, "enemy", "ban"), false);
  assert.equal(isTurnAllowed(turn, "mine", "pick"), false);
  assert.equal(isTurnAllowed(null, "mine", "ban"), false);
});

test("T8 expired timer is only a number: turn and draft are unchanged", () => {
  const { game } = play("mine", 3);
  const before = JSON.stringify(game);
  const turn = getCurrentTurn(game, "mine");
  const deadline = makeDeadline("ban", 1_000);
  assert.equal(secondsLeft(deadline, 1_000 + BAN_SECONDS * 1000 + 5_000), 0);
  assert.equal(JSON.stringify(game), before);
  assert.deepEqual(getCurrentTurn(game, "mine"), turn);
});

test("T9 countdown uses the clock: a background tab resumes with the right time", () => {
  const deadline = makeDeadline("pick", 0);
  assert.equal(secondsLeft(deadline, 0), PICK_SECONDS);
  assert.equal(secondsLeft(deadline, 20_000), 40); // tab hidden for 20s, one tick on resume
  assert.equal(secondsLeft(deadline, 20_001), 40);
  assert.equal(secondsLeft(deadline, 70_000), 0);
  assert.ok(BAN_SECONDS === 40 && PICK_SECONDS === 60);
});

test("T10 the current turn depends only on the draft (toggle off/on, undo, game switch are safe)", () => {
  const { game } = play("mine", 9);
  const a = getCurrentTurn(game, "mine");
  const b = getCurrentTurn(JSON.parse(JSON.stringify(game)), "mine");
  assert.deepEqual(a, b);
  // removing a pick (undo / clear slot) moves the turn back instead of corrupting it
  const removed: DraftGame = { ...game, mine: { ...game.mine, picks: game.mine.picks.map((p, i) => (i === 0 ? null : p)) } };
  const back = getCurrentTurn(removed, "mine") as CurrentTurn;
  assert.ok(back.index <= (a as CurrentTurn).index);
});

test("T11 new draft starts at ban phase 1 for the chosen first pick; switching it keeps hero data", () => {
  const empty = getGame(createSeries("single"), 1) as DraftGame;
  for (const first of ["mine", "enemy"] as const) {
    const t = getCurrentTurn(empty, first) as CurrentTurn;
    assert.deepEqual([t.index, t.phase, t.kind, t.team, t.left], [0, 1, "ban", first, 1]);
  }
  const mid = play("mine", 6).game;
  const before = JSON.stringify(mid);
  const swapped = getCurrentTurn(mid, "enemy") as CurrentTurn;
  assert.equal(JSON.stringify(mid), before);
  const asMine = getCurrentTurn(mid, "mine") as CurrentTurn;
  assert.equal(swapped.index, asMine.index); // same counts, same step...
  assert.notEqual(swapped.team, asMine.team); // ...but the other team now acts
});

test("T12 Global Ban Pick pool rules are untouched (same-team restriction only)", () => {
  let s = createSeries("bo3");
  s = setPickAt(s, 1, "mine", 0, "h0");
  const pool = (team: TeamKey) => getAvailableHeroes({ heroes, series: s, gameNumber: 2, team }).map((h) => h.slug);
  assert.ok(!pool("mine").includes("h0"));
  assert.ok(pool("enemy").includes("h0"));
});

test("T13 a ban lost to the clock is used up: the other team acts next, and the draft still completes", () => {
  const empty = getGame(createSeries("single"), 1) as DraftGame;
  assert.equal((getCurrentTurn(empty, "mine") as CurrentTurn).team, "mine");
  const afterSkip = getCurrentTurn(empty, "mine", { mine: 1, enemy: 0 }) as CurrentTurn;
  assert.deepEqual([afterSkip.index, afterSkip.team, afterSkip.kind], [1, "enemy", "ban"]);
  // both teams time out on every ban: no hero is banned, yet the draft reaches the pick phase
  const allBansLost = getCurrentTurn(empty, "mine", { mine: 4, enemy: 4 }) as CurrentTurn;
  assert.deepEqual([allBansLost.phase, allBansLost.kind, allBansLost.team], [2, "pick", "mine"]);
  // no forfeits recorded = unchanged behaviour
  assert.deepEqual(getCurrentTurn(empty, "mine", { mine: 0, enemy: 0 }), getCurrentTurn(empty, "mine"));
});
