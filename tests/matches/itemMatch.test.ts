import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIDENT_MARGIN, guessSlot, isFlat, layoutFits, slotBox, unit } from "../../src/features/matches/itemMatch.ts";

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

test("only pictures with a shape the layout holds for are read", () => {
  assert.equal(layoutFits(2778, 1284), true); // iPhone
  assert.equal(layoutFits(2576, 1191), true); // the measured iPhone picture
  assert.equal(layoutFits(2644, 1208), true); // measured Android picture, +1.2% wider
  assert.equal(layoutFits(2400, 1080), true); // 20:9, +2.7%: wider only adds margin
  assert.equal(layoutFits(2412, 1080), true); // +3.3%
  assert.equal(layoutFits(2520, 1080), false); // 21:9, +7.9%
  assert.equal(layoutFits(2316, 1080), false); // narrower: the game may fit the page to the width instead
  assert.equal(layoutFits(2048, 1536), false); // tablet
  assert.equal(layoutFits(100, 0), false);
});

test("slot boxes: scaled by the height and centred horizontally", () => {
  const near = (a: number, b: number, eps = 0.6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
  let b = slotBox(2576, 1191, 0, 0); // the measured iPhone picture: unchanged
  near(b.cx, 665); near(b.cy, 333); near(b.half, 33);
  b = slotBox(2644, 1208, 0, 0); // measured Android picture: 15.62 + 665 * 1.01427, 333 * 1.01427
  near(b.cx, 690.1); near(b.cy, 337.8); near(b.half, 33.5);
  b = slotBox(2644, 1208, 5, 4); // last slot of the last row: 15.62 + 1111 * 1.01427, 943 * 1.01427
  near(b.cx, 1142.5); near(b.cy, 956.5);
  // a wider picture only moves everything right by half of the extra width
  const narrow = slotBox(2576, 1191, 2, 1), wide = slotBox(2576 + 100, 1191, 2, 1);
  near(wide.cx - narrow.cx, 50, 0.01); near(wide.cy, narrow.cy, 0.01);
});
