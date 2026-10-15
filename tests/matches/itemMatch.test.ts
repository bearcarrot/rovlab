import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIDENT_MARGIN, guessSlot, isFlat, layoutFits, unit } from "../../src/features/matches/itemMatch.ts";

// Run: node --experimental-strip-types --test tests/matches/itemMatch.test.ts  (the canvas part is browser-only and not covered)
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 255;
const pattern = () => Array.from({ length: 1200 }, rnd);
const tpl = (slug: string, v: number[]) => ({ slug, u: unit(v) });

test("picks the nearest icon, ignoring brightness/contrast changes", () => {
  const a = pattern(), b = pattern(), c = pattern();
  const t = [tpl("a", a), tpl("b", b), tpl("c", c)];
  const dimmed = b.map((x) => x * 0.6 + 20);
  const g = guessSlot(dimmed, t);
  assert.equal(g.slug, "b");
  assert.ok(g.margin > CONFIDENT_MARGIN);
});

test("small noise does not change the answer", () => {
  const a = pattern(), b = pattern();
  const t = [tpl("a", a), tpl("b", b)];
  const noisy = a.map((x) => x + (rnd() - 127) * 0.1);
  assert.equal(guessSlot(noisy, t).slug, "a");
});

test("two near-identical templates give a small margin (user is asked to check)", () => {
  const a = pattern();
  const near = a.map((x) => x + (rnd() - 127) * 0.05);
  const g = guessSlot(a, [tpl("a", a), tpl("a2", near)]);
  assert.ok(g.margin < CONFIDENT_MARGIN);
});

test("an empty slot (flat colour) is null, not a guess", () => {
  const flat = Array.from({ length: 1200 }, (_, i) => [60, 62, 98][i % 3]);
  assert.equal(isFlat(flat), true);
  assert.equal(guessSlot(flat, [tpl("a", pattern())]).slug, null);
  assert.equal(isFlat(pattern()), false);
});

test("only screenshots with the measured proportions are read", () => {
  assert.equal(layoutFits(2778, 1284), true);
  assert.equal(layoutFits(2576, 1191), true);
  assert.equal(layoutFits(2622, 1206), true); // 0.52% wider than the measured one: still inside the tolerance
  assert.equal(layoutFits(2400, 1080), false); // 20:9 phone
  assert.equal(layoutFits(2048, 1536), false); // tablet
  assert.equal(layoutFits(100, 0), false);
});

test("a proportion that is only a little off is refused instead of shifting every icon window", () => {
  assert.equal(layoutFits(2589, 1191), true); // +0.5%
  assert.equal(layoutFits(2563, 1191), true); // -0.5%
  assert.equal(layoutFits(2597, 1191), false); // +0.8%: icon windows could be ~20 px off
  assert.equal(layoutFits(2555, 1191), false); // -0.8%
  assert.equal(layoutFits(2316, 1080), false); // 19.3:9 Android, -0.9%
});
