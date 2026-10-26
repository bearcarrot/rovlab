import { test } from "node:test";
import assert from "node:assert/strict";
import { FOOTER_H, GRID_CELL_PAD, GRID_MAX_TARGET_H, GRID_MIN_H, GRID_MIN_ROW_H, GRID_ROW_GAP, GAP, W, planLaneGrid } from "../../src/lib/share-image/templates/tierLayout.ts";

const grid = (rows: number, cols: number, perCell: number) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => perCell));
const bodyEnd = (p: ReturnType<typeof planLaneGrid>) => p.rowsTop + p.rowHeights.reduce((a, b) => a + b, 0) + GRID_ROW_GAP * Math.max(0, p.rowHeights.length - 1);

test("typical board: standard size, 1080x1350, columns fit the width", () => {
  const p = planLaneGrid(grid(5, 5, 4), 5);
  assert.equal(p.height, GRID_MIN_H);
  assert.equal(p.size, 48);
  assert.ok(p.x0 + 5 * p.colW + 4 * GAP <= W - 40 + 1);
});

test("every cell has room for all its heroes (nothing is truncated) and rows never overlap the footer", () => {
  const cases = [
    { counts: grid(20, 5, 0), cols: 5 }, // 20 empty rows
    { counts: grid(20, 6, 10), cols: 6 }, // many rows + "other" column
    { counts: [[200, 0, 0, 0, 0], ...grid(19, 5, 0)], cols: 5 }, // 200 heroes in one cell
    { counts: grid(20, 5, 10), cols: 5 }, // 1000 placements (every hero in every lane)
    { counts: grid(1, 1, 3), cols: 1 }, // single lane filter
    { counts: [] as number[][], cols: 5 }, // no rows
  ];
  for (const { counts, cols } of cases) {
    const p = planLaneGrid(counts, cols);
    counts.forEach((row, i) => {
      const need = Math.max(0, ...row.map((n) => Math.ceil(n / p.perRow)));
      assert.ok(p.rowHeights[i] >= need * (p.size + GAP) - GAP + GRID_CELL_PAD * 2, `row ${i}`);
      assert.ok(p.rowHeights[i] >= GRID_MIN_ROW_H);
    });
    assert.ok(bodyEnd(p) + FOOTER_H <= p.height, `rows=${counts.length}`);
    assert.ok(p.height >= GRID_MIN_H);
    assert.ok(p.size >= 24);
  }
});

test("large boards shrink icons first, then grow taller instead of dropping heroes", () => {
  const big = planLaneGrid(grid(20, 5, 10), 5);
  assert.ok(big.size < 48);
  const small = planLaneGrid(grid(5, 5, 4), 5);
  assert.ok(big.height > small.height);
  const mid = planLaneGrid(grid(8, 5, 12), 5);
  assert.ok(mid.height <= GRID_MAX_TARGET_H || mid.size === 24);
});
