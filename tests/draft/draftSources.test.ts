import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasComboForTeam,
  hasCounterForEnemies,
  parseSource,
  personalSynergyRels,
  resolveRelations,
} from "../../src/features/draft/draftSources.ts";

const official = {
  counters: [{ victimId: "e1", counterId: "o1", strength: "best" as const, reason: "official", laneTip: "tip" }],
  synergies: [{ heroId: "a", partnerId: "b", reason: "official synergy" }],
};
const pick = (enemy: string, counter: string, strength: "best" | "good" | "situational" = "good", reason = "") => ({
  id: `${enemy}>${counter}`,
  enemyHeroId: enemy,
  counterHeroId: counter,
  strength,
  reason,
  updatedAt: "",
});
// only the fields the module reads
const combo = (heroIds: string[], note = "", name = "คอมโบ") => ({ heroIds, note, name }) as never;

test("defaults: unknown / missing value parses to recommended", () => {
  assert.equal(parseSource(undefined), "recommended");
  assert.equal(parseSource("x"), "recommended");
  assert.equal(parseSource("mine"), "mine");
});

test("both recommended: official relations pass through unchanged", () => {
  const r = resolveRelations({ official, counterSource: "recommended", comboSource: "recommended", myCounters: [pick("e1", "m1")], myCombos: [combo(["x", "y"])] });
  assert.deepEqual(r, official);
});

test("counter=mine, combo=recommended: only counters are swapped, personal data is not mixed with official", () => {
  const r = resolveRelations({ official, counterSource: "mine", comboSource: "recommended", myCounters: [pick("e1", "m1", "best", "mine")], myCombos: [] });
  assert.deepEqual(r?.counters, [{ victimId: "e1", counterId: "m1", strength: "best", reason: "mine", laneTip: "" }]);
  assert.deepEqual(r?.synergies, official.synergies);
});

test("combo=mine, counter=recommended: only synergies are swapped", () => {
  const r = resolveRelations({ official, counterSource: "recommended", comboSource: "mine", myCounters: [], myCombos: [combo(["a", "c"], "my note")] });
  assert.deepEqual(r?.counters, official.counters);
  assert.deepEqual(r?.synergies, [{ heroId: "a", partnerId: "c", reason: "my note" }]);
});

test("empty personal data stays empty: no silent fallback to official", () => {
  const r = resolveRelations({ official, counterSource: "mine", comboSource: "mine", myCounters: [], myCombos: [] });
  assert.deepEqual(r, { counters: [], synergies: [] });
});

test("a personal half does not wait for official data to load", () => {
  const r = resolveRelations({ official: undefined, counterSource: "mine", comboSource: "mine", myCounters: [], myCombos: [] });
  assert.deepEqual(r, { counters: [], synergies: [] });
  assert.equal(resolveRelations({ official: undefined, counterSource: "mine", comboSource: "recommended", myCounters: [], myCombos: [] }), undefined);
});

test("a combo of N heroes expands to every pair; note falls back to name", () => {
  const rels = personalSynergyRels([combo(["a", "b", "c"], "", "ชื่อ")]);
  assert.deepEqual(rels.map((s) => `${s.heroId}|${s.partnerId}`), ["a|b", "a|c", "b|c"]);
  assert.ok(rels.every((s) => s.reason === "ชื่อ"));
});

test("relevance checks for the empty-state messages", () => {
  const picks = [pick("e1", "m1")];
  assert.equal(hasCounterForEnemies(picks, ["e1", "e2"]), true);
  assert.equal(hasCounterForEnemies(picks, ["e2"]), false);
  assert.equal(hasCounterForEnemies(picks, []), false);
  const combos = [combo(["a", "b"])];
  assert.equal(hasComboForTeam(combos, ["b"]), true);
  assert.equal(hasComboForTeam(combos, ["z"]), false);
});
