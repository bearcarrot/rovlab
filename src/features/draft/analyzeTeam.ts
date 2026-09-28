import type { HeroSummary } from "@/types/hero";
import { ROLE_TAGS } from "./heroTags";

export interface TeamAnalysis {
  physicalDamage: number;
  magicDamage: number;
  frontline: number;
  cc: number;
  mobility: number;
  sustain: number;
  earlyGame: number;
  lateGame: number;
  filledSlots: number;
}

// All numbers here are relative point totals from the ROLE_TAGS heuristic, not
// measured game data — the UI must present them as a rough heuristic, never as
// precise math.
export function analyzeTeam(heroes: (HeroSummary | null)[]): TeamAnalysis {
  const picked = heroes.filter((h): h is HeroSummary => h !== null);
  const result: TeamAnalysis = {
    physicalDamage: 0,
    magicDamage: 0,
    frontline: 0,
    cc: 0,
    mobility: 0,
    sustain: 0,
    earlyGame: 0,
    lateGame: 0,
    filledSlots: picked.length,
  };
  for (const h of picked) {
    const tag = ROLE_TAGS[h.role];
    if (tag.damage === "physical") result.physicalDamage += 2;
    else result.magicDamage += 2;
    result.frontline += tag.frontline;
    result.cc += tag.cc;
    result.mobility += tag.mobility;
    result.sustain += tag.sustain;
    if (tag.scaling === "early") result.earlyGame += 2;
    if (tag.scaling === "late") result.lateGame += 2;
  }
  return result;
}

export function recommendPicks(
  currentTeam: (HeroSummary | null)[],
  pool: HeroSummary[]
): { hero: HeroSummary; stars: number; reasons: string[]; risk: "ต่ำ" | "กลาง" | "สูง" }[] {
  const taken = new Set(currentTeam.filter((h): h is HeroSummary => h !== null).map((h) => h.slug));
  const analysis = analyzeTeam(currentTeam);
  const available = pool.filter((h) => !taken.has(h.slug));

  const scored = available.map((h) => {
    const tag = ROLE_TAGS[h.role];
    const reasons: string[] = [];
    let score = 0;

    if (analysis.frontline < 3 && tag.frontline >= 2) {
      reasons.push("ทีมยังขาดแนวหน้า ฮีโร่นี้ช่วยเปิด/รับหน้าไฟต์ได้");
      score += 2;
    }
    if (analysis.cc < 3 && tag.cc >= 2) {
      reasons.push("ทีมมี Crowd Control น้อย ฮีโร่นี้เพิ่มการล็อกเป้าได้");
      score += 2;
    }
    if (analysis.magicDamage === 0 && tag.damage === "magic") {
      reasons.push("ทีมมีแต่ดาเมจกายภาพ ฮีโร่นี้ช่วยให้เจาะเกราะเวทได้");
      score += 1.5;
    }
    if (analysis.physicalDamage === 0 && tag.damage === "physical") {
      reasons.push("ทีมมีแต่ดาเมจเวท ฮีโร่นี้ช่วยให้เจาะเกราะกายภาพได้");
      score += 1.5;
    }
    if (h.stat.tier === "S" || h.stat.tier === "S+") {
      reasons.push(`อยู่ใน Tier ${h.stat.tier} ของแพตช์นี้ Win Rate ${h.stat.winRate.toFixed(1)}%`);
      score += 1;
    }
    if (reasons.length === 0) {
      reasons.push("เติมความหลากหลายให้คอมโพสิชันโดยรวม");
      score += 0.5;
    }

    const stars = Math.min(5, Math.max(1, Math.round(score)));
    const risk = h.difficulty === "hard" ? "สูง" : h.difficulty === "medium" ? "กลาง" : "ต่ำ";
    return { hero: h, stars, reasons, risk: risk as "ต่ำ" | "กลาง" | "สูง" };
  });

  return scored.sort((a, b) => b.stars - a.stars).slice(0, 5);
}
