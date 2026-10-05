import type { Tier } from "@/types/hero";

// Tier List ของฉัน: เก็บฝั่ง Browser เท่านั้น (React state + localStorage) ไม่มี DB / API
export const CUSTOM_TIER_KEY = "rovlab:custom-tier-list";
export const DEFAULT_CUSTOM_NAME = "Tier List ของฉัน";
export const CUSTOM_TIERS: Tier[] = ["S+", "S", "A", "B", "C"];
export const NAME_MAX = 40;

export type CustomTiers = Record<Tier, string[]>; // hero id เรียงตามลำดับที่ผู้ใช้จัด

export interface CustomTierList {
  version: 1;
  name: string;
  patch: string;
  tiers: CustomTiers;
}

export const emptyTiers = (): CustomTiers => ({ "S+": [], S: [], A: [], B: [], C: [] });

export const createDefault = (patch = ""): CustomTierList => ({
  version: 1,
  name: DEFAULT_CUSTOM_NAME,
  patch,
  tiers: emptyTiers(),
});

// อ่านค่าจาก localStorage แบบป้องกันค่าเสีย/schema เก่า/ผู้ใช้ปิด storage
export function loadCustom(): CustomTierList | null {
  try {
    const raw = localStorage.getItem(CUSTOM_TIER_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CustomTierList> | null;
    if (!v || v.version !== 1 || typeof v.name !== "string" || !v.tiers) return null;
    const tiers = emptyTiers();
    const seen = new Set<string>();
    for (const t of CUSTOM_TIERS) {
      const list = (v.tiers as Record<string, unknown>)[t];
      if (!Array.isArray(list)) continue;
      for (const id of list) {
        if (typeof id === "string" && !seen.has(id)) {
          seen.add(id);
          tiers[t].push(id);
        }
      }
    }
    return { version: 1, name: v.name.slice(0, NAME_MAX), patch: typeof v.patch === "string" ? v.patch : "", tiers };
  } catch {
    return null;
  }
}

export function saveCustom(list: CustomTierList): void {
  try {
    localStorage.setItem(CUSTOM_TIER_KEY, JSON.stringify(list));
  } catch {
    // เก็บไม่ได้ (โหมดส่วนตัว/เต็ม) — ยังใช้งานต่อในหน่วยความจำได้
  }
}

export function clearCustom(): void {
  try {
    localStorage.removeItem(CUSTOM_TIER_KEY);
  } catch {
    // ไม่เป็นไร
  }
}

export function findTier(tiers: CustomTiers, id: string): Tier | null {
  return CUSTOM_TIERS.find((t) => tiers[t].includes(id)) ?? null;
}

// ฮีโร่หนึ่งตัวอยู่ได้ Tier เดียว: เอาออกจากที่เดิมแล้วใส่ที่ใหม่ (index ไม่ระบุ = ท้ายแถว)
export function moveHero(tiers: CustomTiers, id: string, to: Tier | null, index?: number): CustomTiers {
  const next = emptyTiers();
  for (const t of CUSTOM_TIERS) next[t] = tiers[t].filter((x) => x !== id);
  if (to) {
    const at = index === undefined ? next[to].length : Math.max(0, Math.min(index, next[to].length));
    next[to].splice(at, 0, id);
  }
  return next;
}

// เลื่อนซ้าย/ขวาในแถวเดียวกัน (ปุ่มแทนการลาก ใช้ได้บนมือถือและคีย์บอร์ด)
export function shiftHero(tiers: CustomTiers, id: string, dir: -1 | 1): CustomTiers {
  const t = findTier(tiers, id);
  if (!t) return tiers;
  const i = tiers[t].indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= tiers[t].length) return tiers;
  const next = { ...tiers, [t]: [...tiers[t]] } as CustomTiers;
  [next[t][i], next[t][j]] = [next[t][j], next[t][i]];
  return next;
}
