import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_HEROES, parseTierData, placeHero, tierHeroCount } from "../../src/features/tierlist/tierData.ts";

const row = (id: string, heroes: string[]) => ({ id, label: id.toUpperCase(), color: "#112233", heroes });

// Companion to duplicatePlacement.test.ts: the 200-placement cap targets a row that really exists.
test("ON: at the placement cap a new placement is refused, a reposition still works", () => {
  const many = Array.from({ length: 150 }, (_, i) => `h${i}`);
  const full = parseTierData({ v: 2, dup: true, rows: [row("s", many), row("a", many), row("b", [])] });
  assert.equal(tierHeroCount(full), MAX_HEROES);
  assert.equal(placeHero(full, "extra", "b", undefined, true), full); // row b exists, board is full
  const moved = placeHero(full, "h0", "a", 0, true);
  assert.equal(tierHeroCount(moved), MAX_HEROES);
});
