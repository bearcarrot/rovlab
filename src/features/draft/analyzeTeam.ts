import type { HeroSummary, Tier } from "@/types/hero";
import type { CounterStrength, DraftRelations } from "@/services/draft";
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

const filled = (team: (HeroSummary | null)[]) => team.filter((h): h is HeroSummary => h !== null);

// All numbers here are relative point totals from the ROLE_TAGS heuristic, not
// measured game data — the UI must present them as a rough heuristic, never as
// precise math.
export function analyzeTeam(heroes: (HeroSummary | null)[]): TeamAnalysis {
  const picked = filled(heroes);
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

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

export type RecommendTag = "firstPick" | "counter" | "synergy";
export type RiskLabel = "ต่ำ" | "กลาง" | "สูง";
// firstPick   = ทั้งสองทีมยังว่าง → ประเมินแบบ blind จากสถิติแพตช์ + ความเสี่ยงโดนเคาน์เตอร์
// counter     = มีศัตรูอย่างน้อย 1 ตัว → เพิ่มคะแนนตัวชนะทาง/หักตัวที่โดนเคาน์เตอร์
// composition = มีแต่ทีมเรา → เติมจุดที่ขาด + คอมโบ
export type DraftMode = "firstPick" | "counter" | "composition";

// รายละเอียดกลไกจากข้อมูลที่แอดมินกรอกไว้ (ใช้ส่งให้ Coach AI อธิบายต่อ)
export interface ComboDetail {
  partner: string;
  reason: string; // ว่างได้ถ้าแอดมินยังไม่ได้กรอก
}
export interface CounterDetail {
  enemy: string;
  direction: "wins" | "loses"; // wins = ฮีโร่นี้ชนะทางศัตรูตัวนี้, loses = ศัตรูตัวนี้ชนะทางฮีโร่นี้
  level: string;
  reason: string;
  laneTip: string;
}

export interface Recommendation {
  hero: HeroSummary;
  score: number;
  stars: number;
  reasons: string[]; // หัวข้อสั้นๆ ว่าทำไมแนะนำ
  explain: string[]; // คำอธิบายกลไกคอมโบ/ชนะทาง จากข้อมูลในระบบ (ว่างถ้าไม่มี)
  warnings: string[];
  tags: RecommendTag[];
  risk: RiskLabel;
  details: { combos: ComboDetail[]; counters: CounterDetail[] };
}

export function getDraftMode(myTeam: (HeroSummary | null)[], enemyTeam: (HeroSummary | null)[]): DraftMode {
  const mine = filled(myTeam).length;
  const enemy = filled(enemyTeam).length;
  if (mine === 0 && enemy === 0) return "firstPick";
  if (enemy > 0) return "counter";
  return "composition";
}

// น้ำหนักคะแนน (ปรับตรงนี้ที่เดียว) — เป็นการประเมินเบื้องต้น ไม่ใช่สถิติที่วัดได้จริง
const COUNTER_POINTS: Record<CounterStrength, number> = { best: 3, good: 2, situational: 1 };
const COUNTER_CAP = 5; // เพดานคะแนนชนะทางรวมทุกตัวศัตรู
const EXPOSURE_WEIGHT: Record<CounterStrength, number> = { best: 1, good: 0.6, situational: 0.3 };
const EXPOSURE_PENALTY_PER_POINT = 0.5;
const EXPOSURE_PENALTY_CAP = 1.5;
const SYNERGY_POINTS = 1.5;
const TIER_POINTS: Record<Tier, number> = { "S+": 2.5, S: 2, A: 1, B: 0.5, C: 0 };
const MIN_MATCHES = 100; // ต่ำกว่านี้ถือว่า Win Rate ยังไม่น่าเชื่อถือ
const LEVEL_TH: Record<CounterStrength, string> = { best: "ดีที่สุด", good: "ดี", situational: "บางสถานการณ์" };
const DEFAULT_LIMIT = 5;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface CounterInfo {
  strength: CounterStrength;
  reason: string;
  laneTip: string;
}

function indexRelations(rel?: DraftRelations) {
  // key: `${ฮีโร่ที่โดนเคาน์เตอร์}>${ฮีโร่ที่ชนะทาง}`
  const counterOf = new Map<string, CounterInfo>();
  // ฮีโร่ที่โดนเคาน์เตอร์ → ผลรวมน้ำหนักตัวที่ชนะทางมัน (ยิ่งสูง ยิ่งโดนแก้ง่าย)
  const exposure = new Map<string, number>();
  for (const c of rel?.counters ?? []) {
    counterOf.set(`${c.victimId}>${c.counterId}`, { strength: c.strength, reason: c.reason, laneTip: c.laneTip });
    exposure.set(c.victimId, (exposure.get(c.victimId) ?? 0) + (EXPOSURE_WEIGHT[c.strength] ?? 0));
  }
  // คอมโบตีความเป็นสองทาง: key `a|b` และ `b|a` → ข้อความอธิบาย (ถ้ามีหลายแถว เก็บอันที่มีข้อความ)
  const synergy = new Map<string, string>();
  const setSynergy = (key: string, reason: string) => {
    if (!synergy.has(key) || (!synergy.get(key) && reason)) synergy.set(key, reason);
  };
  for (const s of rel?.synergies ?? []) {
    setSynergy(`${s.heroId}|${s.partnerId}`, s.reason);
    setSynergy(`${s.partnerId}|${s.heroId}`, s.reason);
  }
  return { counterOf, exposure, synergy };
}

// ctx.limit: จำนวนที่คืนสูงสุด (ค่าเริ่มต้น 5) — ส่งค่ามากๆ เพื่อเอารายการทั้งหมดไปกรองตามแท็ก (คอมโบ/ชนะทาง)
export function recommendPicks(
  currentTeam: (HeroSummary | null)[],
  pool: HeroSummary[],
  ctx: { enemyTeam?: (HeroSummary | null)[]; relations?: DraftRelations; limit?: number } = {}
): Recommendation[] {
  const enemyTeam = ctx.enemyTeam ?? [];
  const mine = filled(currentTeam);
  const enemies = filled(enemyTeam);
  // ฮีโร่ซ้ำกันข้ามทีมไม่ได้ จึงตัดตัวที่ฝั่งศัตรูเลือกไปแล้วออกด้วย
  const taken = new Set([...mine, ...enemies].map((h) => h.slug));
  const mode = getDraftMode(currentTeam, enemyTeam);
  const analysis = analyzeTeam(currentTeam);
  const rel = indexRelations(ctx.relations);
  // ทีมเรายังว่างแต่เห็นศัตรูแล้ว: ลดน้ำหนักการเติมจุดที่ขาด ให้ตัวชนะทางเด่นกว่า
  const compScale = mine.length === 0 ? 0.5 : 1;

  const scored = pool
    .filter((h) => !taken.has(h.slug))
    .map((h): Recommendation => {
      const tag = ROLE_TAGS[h.role];
      const reasons: string[] = [];
      const explain: string[] = [];
      const warnings: string[] = [];
      const tags: RecommendTag[] = [];
      const combos: ComboDetail[] = [];
      const counters: CounterDetail[] = [];
      let score = 0;

      // 1) ชนะทางศัตรูที่เลือกแล้ว
      let counterScore = 0;
      for (const e of enemies) {
        const info = rel.counterOf.get(`${e.id}>${h.id}`);
        if (!info) continue;
        counterScore += COUNTER_POINTS[info.strength];
        reasons.push(`ชนะทาง ${e.nameTh} (ระดับ${LEVEL_TH[info.strength]})`);
        counters.push({ enemy: e.nameTh, direction: "wins", level: LEVEL_TH[info.strength], reason: info.reason, laneTip: info.laneTip });
        if (info.reason) explain.push(`${h.nameTh} ชนะทาง ${e.nameTh}: ${info.reason}`);
        if (info.laneTip) explain.push(`ทิปเลนสู้ ${e.nameTh}: ${info.laneTip}`);
      }
      if (counterScore > 0) {
        score += Math.min(counterScore, COUNTER_CAP);
        tags.push("counter");
      }

      // 2) โดนศัตรูที่เลือกแล้วชนะทาง → หักคะแนนและเตือน
      for (const e of enemies) {
        const info = rel.counterOf.get(`${h.id}>${e.id}`);
        if (!info) continue;
        score -= COUNTER_POINTS[info.strength];
        warnings.push(`${e.nameTh} ชนะทางตัวนี้ (ระดับ${LEVEL_TH[info.strength]})${info.reason ? `: ${info.reason}` : ""}`);
        counters.push({ enemy: e.nameTh, direction: "loses", level: LEVEL_TH[info.strength], reason: info.reason, laneTip: info.laneTip });
      }

      // 3) คอมโบกับเพื่อนร่วมทีม
      for (const t of mine) {
        const key = `${h.id}|${t.id}`;
        if (!rel.synergy.has(key)) continue;
        const reason = rel.synergy.get(key) ?? "";
        score += SYNERGY_POINTS;
        reasons.push(`คอมโบกับ ${t.nameTh}`);
        combos.push({ partner: t.nameTh, reason });
        if (reason) explain.push(`${h.nameTh} + ${t.nameTh}: ${reason}`);
        if (!tags.includes("synergy")) tags.push("synergy");
      }

      // 4) เติมจุดที่ทีมขาด (ข้ามตอน First Pick เพราะทีมยังว่าง ทุกตัวจะได้คะแนนเท่ากันหมด)
      if (mode !== "firstPick") {
        if (analysis.frontline < 3 && tag.frontline >= 2) {
          reasons.push("ทีมยังขาดแนวหน้า ฮีโร่นี้ช่วยเปิด/รับหน้าไฟต์ได้");
          score += 2 * compScale;
        }
        if (analysis.cc < 3 && tag.cc >= 2) {
          reasons.push("ทีมมี Crowd Control น้อย ฮีโร่นี้เพิ่มการล็อกเป้าได้");
          score += 2 * compScale;
        }
        // เช็คเฉพาะตอนมีคนในทีมแล้ว (ทีมว่างไม่ใช่ "มีแต่ดาเมจชนิดเดียว")
        if (analysis.physicalDamage > 0 && analysis.magicDamage === 0 && tag.damage === "magic") {
          reasons.push("ทีมมีแต่ดาเมจกายภาพ ฮีโร่นี้ช่วยให้เจาะเกราะเวทได้");
          score += 1.5;
        }
        if (analysis.magicDamage > 0 && analysis.physicalDamage === 0 && tag.damage === "physical") {
          reasons.push("ทีมมีแต่ดาเมจเวท ฮีโร่นี้ช่วยให้เจาะเกราะกายภาพได้");
          score += 1.5;
        }
      }

      // 5) สถิติแพตช์
      const stat = h.stat;
      const reliable = stat.hasStats && (stat.matches === 0 || stat.matches >= MIN_MATCHES);
      if (mode === "firstPick") {
        tags.push("firstPick");
        if (stat.hasStats) {
          // อัตราแบนไม่ถูกนำมาคิด: ตอนเลือกตัว ช่วงแบนจบแล้ว ตัวที่ถูกแบนไม่อยู่ในพูล
          reasons.push(`First Pick: Tier ${stat.tier} · Win Rate ${stat.winRate.toFixed(1)}% (แพตช์ ${stat.patch})`);
          if (reliable) {
            score += TIER_POINTS[stat.tier];
            if (stat.winRate > 0) score += clamp((stat.winRate - 50) * 0.5, -1, 1.5);
          } else {
            reasons.push(`ตัวอย่างแมตช์ยังน้อย (${stat.matches}) จึงยังไม่นับ Win Rate`);
          }
        } else {
          reasons.push("ยังไม่มีสถิติแพตช์นี้ ประเมินจากบทบาทเท่านั้น");
          score += 0.5;
        }
        // ยังไม่เห็นทีมศัตรู → ตัวที่โดนแก้ง่ายเสี่ยงกว่า
        const exposure = rel.exposure.get(h.id) ?? 0;
        const penalty = Math.min(EXPOSURE_PENALTY_CAP, exposure * EXPOSURE_PENALTY_PER_POINT);
        score -= penalty;
        if (penalty >= 1) warnings.push("โดนเคาน์เตอร์ได้ง่าย เสี่ยงถ้าเลือกก่อนเห็นทีมศัตรู");
      } else if (stat.tier === "S" || stat.tier === "S+") {
        reasons.push(`อยู่ใน Tier ${stat.tier} ของแพตช์นี้ Win Rate ${stat.winRate.toFixed(1)}%`);
        score += 1;
      }

      if (reasons.length === 0) {
        reasons.push("เติมความหลากหลายให้คอมโพสิชันโดยรวม");
        score += 0.5;
      }

      const stars = clamp(Math.round(score * 0.75), 1, 5);
      const risk: RiskLabel = h.difficulty === "hard" ? "สูง" : h.difficulty === "medium" ? "กลาง" : "ต่ำ";
      return { hero: h, score, stars, reasons, explain, warnings, tags, risk, details: { combos, counters } };
    });

  return scored
    .sort((a, b) => b.score - a.score || b.hero.stat.winRate - a.hero.stat.winRate)
    .slice(0, ctx.limit ?? DEFAULT_LIMIT);
}

// สรุปความสัมพันธ์ที่ "เกิดขึ้นแล้ว" ในดราฟต์ปัจจุบัน (คอมโบในทีมเรา + เคาน์เตอร์ข้ามทีม)
// ใช้เป็น context ให้ Coach AI ตอบเรื่องกลไกได้ เพราะ AI อ้างอิงจากข้อมูลที่ส่งไปเท่านั้น
export function describeDraft(
  myTeam: (HeroSummary | null)[],
  enemyTeam: (HeroSummary | null)[],
  relations?: DraftRelations
) {
  const mine = filled(myTeam);
  const enemies = filled(enemyTeam);
  const rel = indexRelations(relations);

  const teamCombos: { heroes: [string, string]; reason: string }[] = [];
  for (let i = 0; i < mine.length; i++) {
    for (let j = i + 1; j < mine.length; j++) {
      const key = `${mine[i].id}|${mine[j].id}`;
      if (rel.synergy.has(key)) {
        teamCombos.push({ heroes: [mine[i].nameTh, mine[j].nameTh], reason: rel.synergy.get(key) ?? "" });
      }
    }
  }

  const matchups: { winner: string; loser: string; level: string; reason: string; laneTip: string }[] = [];
  for (const m of mine) {
    for (const e of enemies) {
      const mineWins = rel.counterOf.get(`${e.id}>${m.id}`); // ศัตรูเป็นฝ่ายโดน, ฮีโร่เราชนะทาง
      if (mineWins) {
        matchups.push({ winner: m.nameTh, loser: e.nameTh, level: LEVEL_TH[mineWins.strength], reason: mineWins.reason, laneTip: mineWins.laneTip });
      }
      const enemyWins = rel.counterOf.get(`${m.id}>${e.id}`);
      if (enemyWins) {
        matchups.push({ winner: e.nameTh, loser: m.nameTh, level: LEVEL_TH[enemyWins.strength], reason: enemyWins.reason, laneTip: enemyWins.laneTip });
      }
    }
  }

  return { teamCombos, matchups };
}
