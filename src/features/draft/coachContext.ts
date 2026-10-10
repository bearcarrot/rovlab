import type { HeroSummary } from "@/types/hero";
import type { AbilitiesByHero } from "@/services/abilities";
import { analyzeTeam, type Recommendation } from "./analyzeTeam";

// Edge function ai-coach ตัด context ที่ 8000 ตัวอักษร (JSON.stringify(...).slice(0, 8000))
// ถ้าเกิน JSON จะขาดกลางทาง AI อ่านไม่ออก จึงเผื่อไว้ที่ 7200 แล้วค่อยๆ ย่อข้อความสกิลจนพอดี
const BUDGET = 7200;
const TEXT_STEPS = [320, 220, 150, 100, 60, 0];

// บอก AI ตรงๆ ว่าข้อมูลส่วนไหนเชื่อได้แค่ไหน (ดู system prompt ใน ai-coach ด้วย)
const DATA_NOTE =
  "stat เป็น null = ยังไม่มีสถิติจริง ห้ามอ้าง Tier/Win Rate; " +
  "teamProfile และ reasons ที่พูดถึงแนวหน้า/CC/ดาเมจ เป็นการประเมินคร่าวๆ ตามบทบาท (heuristic) ไม่ใช่ข้อมูลยืนยัน; " +
  "skills[].tags (เช่น ฮีล/โล่/บัฟ) เป็นแท็กชนิดสกิลที่เกมระบุไว้จริง";

const squash = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, Math.max(0, n - 1))}…`;
};

// สถิติจริงเท่านั้น: ฮีโร่ที่ไม่มีสถิติจะมีค่าเริ่มต้น (Tier C / 0%) ซึ่งเป็นค่าสมมติ ห้ามส่งให้ AI
function statOf(hero: HeroSummary) {
  const s = hero.stat;
  if (!s.hasStats) return null;
  return { tier: s.tier, winRate: s.winRate, patch: s.patch };
}

// ภาพรวมทีมแบบหยาบ (จาก ROLE_TAGS) — null ถ้าทีมยังว่าง
function teamProfile(team: HeroSummary[]) {
  if (team.length === 0) return null;
  const a = analyzeTeam(team);
  const damage =
    a.physicalDamage >= a.magicDamage * 2 ? "physical" : a.magicDamage >= a.physicalDamage * 2 ? "magic" : "mixed";
  return { heroes: team.length, damage, frontline: a.frontline, cc: a.cc };
}

function skillsOf(skills: AbilitiesByHero, hero: HeroSummary, n: number) {
  return (skills[hero.id] ?? []).map((a) => ({
    slot: a.slot,
    name: a.name,
    // แท็กชนิดสกิลจากเกม (ฮีล/โล่/บัฟ ...) ส่งเฉพาะสกิลที่มีแท็ก เพื่อไม่กินงบตัวอักษร
    ...(a.effectTags.length > 0 ? { tags: a.effectTags } : {}),
    text: n > 0 ? squash(a.description, n) : "",
  }));
}

function heroBlock(skills: AbilitiesByHero, hero: HeroSummary, n: number) {
  return { name: hero.nameTh, role: hero.role, skills: skillsOf(skills, hero, n) };
}

// สร้าง context โดยย่อข้อความสกิลทีละขั้นจนขนาดไม่เกิน BUDGET (ชื่อสกิลยังอยู่ครบเสมอ)
function fit<T>(build: (n: number) => T): T {
  for (const n of TEXT_STEPS) {
    const v = build(n);
    if (JSON.stringify(v).length <= BUDGET) return v;
  }
  return build(0);
}

const uniq = (list: HeroSummary[]) => [...new Map(list.map((h) => [h.id, h])).values()];

/**
 * context สำหรับปุ่ม "ถาม Coach Ai" บนการ์ดแนะนำ
 * ใส่สกิลของ: ฮีโร่ที่แนะนำ + คู่คอมโบ + ศัตรูที่เกี่ยวข้อง (ชนะทาง/โดนชนะทาง)
 * ถ้ายังไม่มีข้อมูลความสัมพันธ์เลย จะใส่สกิลของศัตรูทั้งหมดที่เลือกไว้แทน เพื่อให้ AI วิเคราะห์จากสกิลได้
 */
export function buildPickContext(
  rec: Recommendation,
  opts: { mine: HeroSummary[]; enemies: HeroSummary[]; skills: AbilitiesByHero }
) {
  const { mine, enemies, skills } = opts;
  const partners = rec.details.combos
    .map((c) => mine.find((h) => h.nameTh === c.partner))
    .filter((h): h is HeroSummary => !!h);
  const related = rec.details.counters
    .map((c) => enemies.find((h) => h.nameTh === c.enemy))
    .filter((h): h is HeroSummary => !!h);
  const heroes = uniq([rec.hero, ...partners, ...related, ...(related.length === 0 ? enemies : [])]);

  return fit((n) => ({
    hero: rec.hero.nameTh,
    role: rec.hero.role,
    stat: statOf(rec.hero), // null = ไม่มีสถิติจริง
    risk: rec.risk,
    reasons: rec.reasons,
    warnings: rec.warnings,
    combos: rec.details.combos, // [{ partner, reason }]
    counters: rec.details.counters, // [{ enemy, direction, level, reason, laneTip }]
    team: { mine: mine.map((h) => h.nameTh), enemy: enemies.map((h) => h.nameTh) },
    teamProfile: { mine: teamProfile(mine), enemy: teamProfile(enemies) },
    dataNote: DATA_NOTE,
    heroes: heroes.map((h) => heroBlock(skills, h, n)), // สกิลจริงจากฐานข้อมูล
  }));
}

/** context สำหรับปุ่ม "ประเมินดราฟต์": สกิลของทุกตัวที่เลือกไว้ (ทั้งสองทีม) + คอมโบ/matchup ที่มีในระบบ */
export function buildDraftContext(
  base: Record<string, unknown>,
  opts: { mine: HeroSummary[]; enemies: HeroSummary[]; skills: AbilitiesByHero }
) {
  const { mine, enemies, skills } = opts;
  return fit((n) => ({
    ...base,
    teamProfile: { mine: teamProfile(mine), enemy: teamProfile(enemies) },
    dataNote: DATA_NOTE,
    heroes: [...mine, ...enemies].map((h) => ({ team: mine.includes(h) ? "mine" : "enemy", ...heroBlock(skills, h, n) })),
  }));
}
