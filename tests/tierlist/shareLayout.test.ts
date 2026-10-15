import { test } from "node:test";
import assert from "node:assert/strict";
import { FOOTER_H, GAP, H, HEADER_H, LABEL_W, MIN_ROW_H, PAD, ROW_GAP, ROW_PAD, W, layout } from "../../src/lib/share-image/templates/tierLayout.ts";
import { readableTextColor } from "../../src/lib/readableText.ts";

const rows = (...counts: number[]) => counts.map((n) => ({ heroes: Array.from({ length: n }, (_, i) => i) }));
const total = (p: ReturnType<typeof layout>) => p.heights.reduce((a, b) => a + b, 0) + p.rowGap * Math.max(0, p.heights.length - 1);
const room = H - HEADER_H - FOOTER_H;

// The algorithm that shipped before custom rows (git: layout() in templates/tier-list.ts), kept to prove default lists render the same.
function legacy(tiers: { heroes: unknown[] }[]) {
  const areaW = W - PAD * 2 - LABEL_W - ROW_PAD * 2;
  const availH = H - HEADER_H - FOOTER_H - ROW_GAP * Math.max(0, tiers.length - 1);
  for (let size = 104; size >= 22; size -= 2) {
    const perRow = Math.max(1, Math.floor((areaW + GAP) / (size + GAP)));
    const heights = tiers.map((t) => Math.max(MIN_ROW_H, Math.ceil(t.heroes.length / perRow) * (size + GAP) - GAP + ROW_PAD * 2));
    if (heights.reduce((a, b) => a + b, 0) <= availH || size === 22) return { size, perRow, heights };
  }
  throw new Error("unreachable");
}

test("default five-tier lists lay out exactly as before", () => {
  for (const counts of [[0, 0, 0, 0, 0], [3, 5, 4, 2, 1], [10, 20, 25, 15, 10], [30, 30, 30, 30, 30], [1, 0, 0, 0, 40]]) {
    const t = rows(...counts);
    const now = layout(t);
    const old = legacy(t);
    if (total(now) <= room) {
      assert.equal(now.size, old.size, counts.join());
      assert.deepEqual(now.heights, old.heights, counts.join());
      assert.equal(now.rowGap, ROW_GAP);
    }
  }
});

test("many rows and many heroes never overflow the footer", () => {
  const cases = [
    rows(...Array(20).fill(0)),
    rows(...Array(20).fill(1)),
    rows(...Array(20).fill(10)),
    rows(200, ...Array(19).fill(0)),
    rows(...Array(10).fill(20)),
    rows(1),
    rows(0),
    rows(...Array(8).fill(25)),
  ];
  for (const t of cases) {
    const p = layout(t);
    assert.ok(p.fits, `rows=${t.length}`);
    assert.ok(total(p) <= room, `rows=${t.length} total=${total(p)} room=${room}`);
    assert.ok(p.size >= 16);
    assert.equal(p.heights.length, t.length);
  }
});

test("label text color picks the higher-contrast option (default tier colors get dark text for WCAG AA)", () => {
  for (const c of ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#FFFFFF", "#F5F5F5", "#FDE68A"]) assert.equal(readableTextColor(c), "#0A0B0E", c);
  for (const c of ["#000000", "#1D4ED8", "#B91C1C"]) assert.equal(readableTextColor(c), "#FFFFFF", c);
  assert.equal(readableTextColor("nope"), "#FFFFFF");
});
