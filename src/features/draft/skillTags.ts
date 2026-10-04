import type { AbilitiesByHero } from "@/services/abilities";

// ความสามารถของชุดสกิลฮีโร่ อ่านจาก "แท็กชนิดสกิล" ที่เกมระบุไว้ในแต่ละสกิล (เช่น ฮีล / โล่ / บัฟ)
// เป็นข้อมูลจากเกมโดยตรง ไม่ใช่ heuristic ตามบทบาทเหมือน ROLE_TAGS
export interface KitCaps {
  heal: boolean;
  shield: boolean;
  buff: boolean;
}
// hero_id → ความสามารถ (มีเฉพาะฮีโร่ที่นำเข้าแท็กแล้ว; ไม่มี = ไม่มีข้อมูล ไม่ได้แปลว่าไม่มีความสามารถ)
export type KitsByHero = Record<string, KitCaps>;

// ชื่อแท็กจากเกม → ความสามารถ ตอนนี้รู้จัก ฮีล / โล่ / บัฟ
// เมื่อเจอแท็กชนิดอื่นที่ใช้ได้ (เช่น คุมฝูงชน, พุ่งเข้า) เพิ่มกฎที่นี่ที่เดียว
const RULES: { cap: keyof KitCaps; match: RegExp }[] = [
  { cap: "heal", match: /ฮีล/ },
  { cap: "shield", match: /โล่/ },
  { cap: "buff", match: /บัฟ/ },
];

export function buildKits(skills: AbilitiesByHero): KitsByHero {
  const out: KitsByHero = {};
  for (const [heroId, list] of Object.entries(skills)) {
    const names = list.flatMap((a) => a.effectTags);
    if (names.length === 0) continue;
    const caps: KitCaps = { heal: false, shield: false, buff: false };
    for (const rule of RULES) if (names.some((n) => rule.match.test(n))) caps[rule.cap] = true;
    out[heroId] = caps;
  }
  return out;
}
