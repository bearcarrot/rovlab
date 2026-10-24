import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDraft } from "../../src/features/matches/scan.ts";

// Run: node --experimental-strip-types --test tests/matches/scan.test.ts  (Node >= 22.6, no extra deps)
const hero = (name: string, lane = "mid") => ({ id: `id-${name}`, name, nameTh: name, lane }) as never;
const HEROES = [hero("Valhein"), hero("Zuka", "jungle"), hero("Flowborn (Mage)", "mid"), hero("Flowborn (Carry)", "abyssal")];
const player = (i: number, over: Record<string, unknown> = {}) => ({
  team: i < 5 ? "blue" : "red", hero: i === 0 ? "Valhein" : "Zuka", playerName: `p${i}`,
  kills: 0, deaths: 1, assists: 1, gold: 5000, rating: 7, mvp: false, isMe: i === 0, ...over,
});
const draft = (me: Record<string, unknown> = {}, others: Record<string, unknown> = {}) => ({
  result: "victory", scoreBlue: 0, scoreRed: 0, duration: "13:49", playedAt: "2026-10-10T13:45",
  players: Array.from({ length: 10 }, (_, i) => player(i, i === 0 ? me : others)),
}) as never;
const blocking = (d: never, heroes = HEROES) => checkDraft(d, heroes).filter((i) => i.blocking).map((i) => i.code);

test("user's hero matched => no hero issue", () => {
  assert.deepEqual(blocking(draft()), []);
});

test("user's hero not in the catalogue blocks saving", () => {
  assert.deepEqual(blocking(draft({ hero: "Nobody" })), ["hero_unmatched"]);
});

test("unmatched opponent hero stays allowed", () => {
  assert.deepEqual(blocking(draft({}, { hero: "Nobody" })), []);
});

test("empty hero name gives hero_empty only, not hero_unmatched", () => {
  assert.deepEqual(blocking(draft({ hero: " " })), ["hero_empty"]);
});

test("empty catalogue (failed load) is its own blocking issue, not 'unmatched'", () => {
  assert.deepEqual(blocking(draft(), []), ["heroes_unavailable"]);
});

test("ambiguous Flowborn still requires an explicit pick", () => {
  assert.deepEqual(blocking(draft({ hero: "Flowborn" })), ["hero_ambiguous"]);
  assert.deepEqual(blocking(draft({ hero: "Flowborn (Carry)" })), []);
});
