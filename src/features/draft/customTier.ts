import type { TierData } from "../tierlist/tierData";

// เทียร์ที่ผู้ใช้จัดเองใน "Tier List ของฉัน" แปลงเป็นป้ายสำหรับหน้า Draft (ชื่อแถว + สี + สีตัวอักษรที่อ่านออก)
// ไม่พึ่ง dependency อื่น เพื่อเทสต์ด้วย node:test ได้

export interface CustomTier {
  label: string;
  color: string; // #RRGGBB
  fg: "#000000" | "#FFFFFF";
}
export type CustomTierMap = ReadonlyMap<string, CustomTier>;

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** ผู้ใช้เลือกสีแถวอะไรก็ได้ จึงเลือกดำ/ขาวตามความสว่างของสีพื้น (ค่าที่ไม่ใช่ #RRGGBB = ขาว) */
export function textColorFor(hex: string): "#000000" | "#FFFFFF" {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return lum > 0.179 ? "#000000" : "#FFFFFF";
}

/** hero id → ป้ายของแถวที่ฮีโร่อยู่ (ฮีโร่ที่ไม่อยู่ในลิสต์จะไม่มีในแผนที่) */
export function buildCustomTierMap(rows: TierData): CustomTierMap {
  const out = new Map<string, CustomTier>();
  for (const r of rows) {
    const tier: CustomTier = { label: r.label, color: r.color, fg: textColorFor(r.color) };
    for (const id of r.heroes) if (!out.has(id)) out.set(id, tier);
  }
  return out;
}
