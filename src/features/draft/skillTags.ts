import type { AbilitiesByHero } from "@/services/abilities";
import { tagGroup } from "@/lib/effectTags";
import { ROLE_TAGS } from "./heroTags";
import type { HeroRole } from "@/types/hero";

// ความสามารถของชุดสกิลฮีโร่ อ่านจาก "แท็กชนิดสกิล" ที่เกมระบุไว้ในแต่ละสกิล
// เป็นข้อมูลจากเกมโดยตรง ไม่ใช่ heuristic ตามบทบาทเหมือน ROLE_TAGS
export interface KitCaps {
  heal: boolean;
  shield: boolean;
  buff: boolean;
  // จำนวนสกิล (ไม่นับร่าง -ex) ที่มีแท็กดาเมจกายภาพ / เวท (ความเสียหายผสม นับทั้งสองฝั่ง)
  physical: number;
  magic: number;
  // จำนวนสกิลที่มีแท็กคุมฝูงชน (สตั๊น/ลอยขึ้น/ผลัก/ใบ้/ล็อคตัว ฯลฯ)
  ccCount: number;
  slow: boolean;
  mobility: boolean;
}
// hero_id → ความสามารถ (มีเฉพาะฮีโร่ที่นำเข้าแท็กแล้ว; ไม่มี = ไม่มีข้อมูล ไม่ได้แปลว่าไม่มีความสามารถ)
export type KitsByHero = Record<string, KitCaps>;

const IS_EX_FORM = /-ex/i;

export function buildKits(skills: AbilitiesByHero): KitsByHero {
  const out: KitsByHero = {};
  for (const [heroId, list] of Object.entries(skills)) {
    if (!list.some((a) => a.effectTags.length > 0)) continue;
    const caps: KitCaps = { heal: false, shield: false, buff: false, physical: 0, magic: 0, ccCount: 0, slow: false, mobility: false };
    for (const a of list) {
      const groups = new Set(a.effectTags.map(tagGroup));
      // "ป้องกัน" (type 5) = สกิลที่ให้โล่ — ก่อนหน้านี้เช็ค /โล่/ ซึ่งไม่มีในข้อมูลจริง จึงไม่เคยจับโล่ได้
      if (groups.has("heal")) caps.heal = true;
      if (a.effectTags.includes("ป้องกัน")) caps.shield = true;
      if (groups.has("buff")) caps.buff = true;
      if (groups.has("slow")) caps.slow = true;
      if (groups.has("mobility")) caps.mobility = true;
      // ร่าง -ex ซ้ำสกิลปกติ ไม่นับซ้ำเพื่อไม่ให้ตัวเลขเพี้ยน
      if (IS_EX_FORM.test(a.slot)) continue;
      if (groups.has("physical") || groups.has("mixed")) caps.physical += 1;
      if (groups.has("magic") || groups.has("mixed")) caps.magic += 1;
      if (groups.has("cc")) caps.ccCount += 1;
    }
    out[heroId] = caps;
  }
  return out;
}

// สัดส่วนดาเมจกายภาพ/เวทของฮีโร่ รวมเป็น 2 แต้มเท่าเดิม (ให้สเกลเท่าที่ analyzeTeam ใช้อยู่)
// มีแท็กสกิล → แบ่งตามสัดส่วนสกิล · ไม่มี → ใช้ ROLE_TAGS เหมือนเดิม
export function damageSplit(role: HeroRole, kit?: KitCaps): { physical: number; magic: number } {
  const p = kit?.physical ?? 0;
  const m = kit?.magic ?? 0;
  if (p + m > 0) return { physical: (2 * p) / (p + m), magic: (2 * m) / (p + m) };
  return ROLE_TAGS[role].damage === "physical" ? { physical: 2, magic: 0 } : { physical: 0, magic: 2 };
}

// ค่า CC ของฮีโร่ (สเกลเดียวกับ ROLE_TAGS.cc 0-3): มีแท็กสกิล → นับจากจำนวนสกิลที่คุมได้จริง
export function heroCc(role: HeroRole, kit?: KitCaps): number {
  return kit ? Math.min(3, kit.ccCount) : ROLE_TAGS[role].cc;
}
