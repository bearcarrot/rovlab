// Pure row layout of the Tier List PNG (no imports, so it can be unit tested): picks the icon size and row heights.

export const W = 1080;
export const H = 1350;
export const PAD = 40;
export const HEADER_H = 218;
export const FOOTER_H = 132;
export const LABEL_W = 124;
export const GAP = 6;
export const ROW_GAP = 12;
export const ROW_PAD = 12;
export const MIN_ROW_H = 72;

export interface Plan {
  size: number;
  perRow: number;
  heights: number[];
  rowGap: number;
  pad: number;
  fits: boolean;
}

function plan(tiers: { heroes: unknown[] }[], rowGap: number, pad: number, minH: number, minSize: number): Plan {
  const areaW = W - PAD * 2 - LABEL_W - pad * 2;
  const availH = H - HEADER_H - FOOTER_H - rowGap * Math.max(0, tiers.length - 1);
  let last: Plan | null = null;
  for (let size = 104; size >= minSize; size -= 2) {
    const perRow = Math.max(1, Math.floor((areaW + GAP) / (size + GAP)));
    const heights = tiers.map((t) => Math.max(minH, Math.ceil(t.heroes.length / perRow) * (size + GAP) - GAP + pad * 2));
    last = { size, perRow, heights, rowGap, pad, fits: heights.reduce((a, b) => a + b, 0) <= availH };
    if (last.fits) return last;
  }
  return last!;
}

// ปกติ (เหมือนเดิมทุกพิกเซลสำหรับ Tier List แถวไม่มาก); ถ้าแถว/ฮีโร่เยอะจนไม่พอ ใช้โหมดกระชับ (ช่องไฟ/แถวว่างเล็กลง ไอคอนเล็กสุด 16px)
// ที่ขีดจำกัด 20 แถว/200 ฮีโร่ ยังไม่ทับส่วนท้าย
export function layout(tiers: { heroes: unknown[] }[]): Plan {
  const normal = plan(tiers, ROW_GAP, ROW_PAD, MIN_ROW_H, 22);
  return normal.fits ? normal : plan(tiers, 6, 6, 26, 16);
}

// ---- lane grid variant (Tier rows x lane columns) ----
// The image grows taller instead of dropping heroes: icons shrink (48 -> 24px) until the image is at most GRID_MAX_TARGET_H
// tall; at 24px it just keeps growing (20 rows x 200 placements stays far below canvas limits).

export const GRID_LABEL_W = 96;
export const GRID_HEAD_H = 64;
export const GRID_CELL_PAD = 8;
export const GRID_ROW_GAP = 10;
export const GRID_MIN_ROW_H = 64;
export const GRID_MIN_H = H;
export const GRID_MAX_TARGET_H = 3200;
const GRID_SIZES = [48, 44, 40, 36, 32, 28, 24];

export interface GridPlan {
  /** x of the first lane column, and the width of each column */
  x0: number;
  colW: number;
  size: number;
  perRow: number;
  rowHeights: number[];
  /** y of the first Tier row */
  rowsTop: number;
  /** total image height */
  height: number;
}

/** counts[row][column] = number of heroes in that cell; `cols` >= 1 columns (lanes, plus an optional "other" column). */
export function planLaneGrid(counts: number[][], cols: number): GridPlan {
  const x0 = PAD + GRID_LABEL_W + GAP;
  const colW = Math.floor((W - PAD - x0 - GAP * (cols - 1)) / cols);
  const rowsTop = HEADER_H + GRID_HEAD_H;
  let result!: GridPlan;
  for (const size of GRID_SIZES) {
    const perRow = Math.max(1, Math.floor((colW - GRID_CELL_PAD * 2 + GAP) / (size + GAP)));
    const rowHeights = counts.map((r) => {
      const lines = Math.max(0, ...r.map((n) => Math.ceil(n / perRow)));
      return Math.max(GRID_MIN_ROW_H, lines * (size + GAP) - GAP + GRID_CELL_PAD * 2);
    });
    const body = rowHeights.reduce((a, b) => a + b, 0) + GRID_ROW_GAP * Math.max(0, counts.length - 1);
    const height = Math.max(GRID_MIN_H, rowsTop + body + FOOTER_H + 16);
    result = { x0, colW, size, perRow, rowHeights, rowsTop, height };
    if (height <= GRID_MAX_TARGET_H) return result;
  }
  return result;
}
