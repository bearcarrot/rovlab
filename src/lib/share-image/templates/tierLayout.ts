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

