import type { CounterEntry, HeroAbility } from "@/types/hero";
import type { HeroBuild, ItemSummary } from "@/types/item";

// คำตอบ Quick Chat ที่ดึงจากข้อมูลในระบบ (DB) ตรงๆ โดยไม่เรียก AI (ไม่เสียโควต้า Gemini)
// หลักการ: ทุกบรรทัดต้องมาจากฟิลด์ใน DB เท่านั้น ไม่วิเคราะห์ ไม่แต่งเพิ่ม
// คืน undefined เมื่อข้อมูลไม่พอหรือไม่แน่ใจ → CoachFab ส่งคำถามต่อให้ ai-coach (Gemini) ตามเดิม
// Pure TS (ไม่ import React) เพื่อเทสด้วย node --test ได้ (tests/coach/directAnswers.test.ts)

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const list = (a: readonly unknown[] | null | undefined) => (a ?? []).map(clean).filter(Boolean);

/** ใช้สกิลยังไง: ชื่อ + คำอธิบายสกิลจริงทุกสกิล (ถ้ามีสกิลไหนไม่มีคำอธิบาย = ข้อมูลไม่ครบ ให้ AI ตอบแทน) */
export function skillsAnswer(heroName: string, abilities: readonly Pick<HeroAbility, "slot" | "name" | "description">[]): string | undefined {
  const rows = abilities.map((a) => ({ slot: clean(a.slot), name: clean(a.name), desc: clean(a.description) })).filter((r) => r.name);
  if (rows.length === 0 || rows.some((r) => !r.desc)) return undefined;
  return [
    `สกิลของ ${heroName} ตามข้อมูลในระบบ`,
    ...rows.map((r) => `- ${r.slot ? `[${r.slot}] ` : ""}**${r.name}**: ${r.desc}`),
  ].join("\n");
}

/** จุดแข็ง จุดอ่อน: ต้องมีทั้งสองฝั่งในระบบ ไม่งั้นให้ AI ตอบแทน */
export function prosConsAnswer(heroName: string, strengths: readonly string[], weaknesses: readonly string[]): string | undefined {
  const s = list(strengths);
  const w = list(weaknesses);
  if (s.length === 0 || w.length === 0) return undefined;
  return [`จุดแข็งและจุดอ่อนของ ${heroName} ตามข้อมูลในระบบ`, "**จุดแข็ง**", ...s.map((x) => `- ${x}`), "**จุดอ่อน**", ...w.map((x) => `- ${x}`)].join("\n");
}

// ข้อความเดียวกับรายการฮีโร่ชนะทางในหน้า Counter Pick (features/heroes/CounterList.tsx)
const STRENGTH_LABEL: Record<CounterEntry["strength"], string> = {
  best: "ชนะทางได้ดีที่สุด",
  good: "ชนะทางได้ดี",
  situational: "ใช้ได้เฉพาะสถานการณ์",
};
const STRENGTH_ORDER: Record<CounterEntry["strength"], number> = { best: 0, good: 1, situational: 2 };
const HOW_TO_FACE_LIMIT = 5;

/** เจอ X ต้องเล่นยังไง: ฮีโร่ที่ชนะทางพร้อมเหตุผลและเคล็ดลับเลนที่ทีมงานเขียนไว้ (ต้องมีเหตุผลหรือเคล็ดลับอย่างน้อย 1 รายการ) */
export function howToFaceAnswer(enemyName: string, counteredBy: readonly CounterEntry[]): string | undefined {
  const rows = counteredBy
    .map((c, i) => ({ i, name: clean(c.heroNameTh), strength: c.strength, reason: clean(c.reason), tip: clean(c.laneTip) }))
    .filter((r) => r.name && (r.reason || r.tip))
    .sort((a, b) => (STRENGTH_ORDER[a.strength] ?? 9) - (STRENGTH_ORDER[b.strength] ?? 9) || a.i - b.i)
    .slice(0, HOW_TO_FACE_LIMIT);
  if (rows.length === 0) return undefined;
  const lines = rows.map((r) => {
    const parts = [r.reason, r.tip ? `เคล็ดลับเลน: ${r.tip}` : ""].filter(Boolean).join(" · ");
    return `- **${r.name}** (${STRENGTH_LABEL[r.strength] ?? ""}): ${parts}`;
  });
  return [`ฮีโร่ที่ชนะทาง ${enemyName} ตามข้อมูลในระบบ`, ...lines].join("\n");
}

export interface MatchupPlanInput {
  aName: string;
  bName: string;
  /** "" = ไม่มีเลนร่วมกัน */
  lane: string;
  difficulty: string;
  early: string;
  mid: string;
  late: string;
  winCondition: string;
  tips: string;
  source: "curated" | "heuristic";
  /** แผนที่เก็บไว้เขียนจากมุมมองของฝั่งศัตรู ไม่ใช่ของผู้ใช้ */
  reversed: boolean;
}

/** แผนเล่นคู่นี้: เฉพาะแผนที่ทีมงานเขียนไว้ให้ฝั่งผู้ใช้เท่านั้น (แผนของฝั่งศัตรู/ข้อมูลสถิติล้วน ให้ AI ตอบแทน) */
export function matchupPlanAnswer(m: MatchupPlanInput): string | undefined {
  if (m.source !== "curated" || m.reversed) return undefined;
  const sections: [string, string][] = [
    ["ต้นเกม", clean(m.early)],
    ["กลางเกม", clean(m.mid)],
    ["ท้ายเกม", clean(m.late)],
    ["เงื่อนไขชนะ", clean(m.winCondition)],
    ["เคล็ดลับ", clean(m.tips)],
  ];
  const filled = sections.filter(([, t]) => t);
  if (filled.length === 0) return undefined;
  const lane = clean(m.lane);
  const meta = [lane ? `เลน: ${lane}` : "", clean(m.difficulty) ? `ความยาก: ${clean(m.difficulty)}` : ""].filter(Boolean).join(" · ");
  return [`แผนเล่น ${m.aName} เจอ ${m.bName} ที่ทีมงานเขียนไว้`, ...(meta ? [meta] : []), ...filled.map(([k, t]) => `- **${k}**: ${t}`)].join("\n");
}

// ข้อความเดียวกับการ์ดบิลด์แนะนำ (features/build/buildView.tsx)
const PHASE_LABEL: Record<string, string> = { early: "ต้นเกม", core: "ไอเทมหลัก", situational: "ตามสถานการณ์" };

/**
 * ทำไมบิลด์นี้เหมาะ: เฉพาะบิลด์ curated ที่แอดมินเขียนเหตุผลไว้อย่างน้อย 1 รายการ
 * ไอเทมที่ไม่พบในตาราง items ถูกข้าม (ไม่แต่งชื่อ) ชื่อไอเทม/รูนเป็นภาษาอังกฤษตามเกม เหมือน context ที่ส่งให้ AI
 */
export function buildWhyAnswer(
  heroName: string,
  build: HeroBuild | null | undefined,
  items: readonly ItemSummary[],
  latestPatch: string | null,
): string | undefined {
  if (!build || build.source !== "curated") return undefined;
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const itemRows = build.items.flatMap((b) => {
    const it = bySlug.get(b.itemSlug);
    return it && clean(it.name) ? [{ name: clean(it.name), phase: PHASE_LABEL[b.phase] ?? "", reason: clean(b.reason) }] : [];
  });
  const runeRows = (build.arcana ?? []).map((a) => ({ name: clean(a.name), reason: clean(a.reason) })).filter((r) => r.name && r.reason);
  if (itemRows.every((r) => !r.reason) && runeRows.length === 0) return undefined;

  const patch = clean(build.patch);
  const stale = !!latestPatch && !!patch && patch !== latestPatch;
  const out = [`เหตุผลของบิลด์ ${heroName} ตามข้อมูลในระบบ${patch ? ` (แพตช์ ${patch}${stale ? ` เก่ากว่าแพตช์ปัจจุบัน ${latestPatch}` : ""})` : ""}`];
  if (itemRows.length > 0) {
    out.push("**ไอเทม**");
    for (const r of itemRows) out.push(`- **${r.name}**${r.phase ? ` (${r.phase})` : ""}${r.reason ? `: ${r.reason}` : ""}`);
  }
  if (runeRows.length > 0) {
    out.push("**รูน**");
    for (const r of runeRows) out.push(`- **${r.name}**: ${r.reason}`);
  }
  out.push("บิลด์นี้เป็นของ RoV LAB อาจอัปเดตช้ากว่าในเกม แนะนำดูบิลด์ Top 10 Server ในเกมควบคู่");
  return out.join("\n");
}
