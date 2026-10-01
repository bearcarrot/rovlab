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

export interface Recommendation {
  hero: HeroSummary;
  score: number;
  stars: number;
  reasons: string[];
  warnings: string[];
  tags: RecommendTag[];
  risk: RiskLabel;
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

function indexRelations(rel?: DraftRelations) {
  // key: `${ฮีโร่ที่โดนเคาน์เตอร์}>${ฮีโร่ที่ชนะทาง}`
  const counterOf = new Map<string, CounterStrength>();
  // ฮีโร่ที่โดนเคาน์เตอร์ → ผลรวมน้ำหนักตัวที่ชนะทางมัน (ยิ่งสูง ยิ่งโดนแก้ง่าย)
  const exposure = new Map<string, number>();
  for (const c of rel?.counters ?? []) {
    counterOf.set(`${c.victimId}>${c.counterId}`, c.strength);
    exposure.set(c.victimId, (exposure.get(c.victimId) ?? 0) + (EXPOSURE_WEIGHT[c.strength] ?? 0));
  }
  // คอมโบตีความเป็นสองทาง
  const synergy = new Set<string>();
  for (const s of rel?.synergies ?? []) {
    synergy.add(`${s.heroId}|${s.partnerId}`);
    synergy.add(`${s.partnerId}|${s.heroId}`);
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
      const warnings: string[] = [];
      const tags: RecommendTag[] = [];
      let score = 0;

      // 1) ชนะทางศัตรูที่เลือกแล้ว
      let counterScore = 0;
      for (const e of enemies) {
        const s = rel.counterOf.get(`${e.id}>${h.id}`);
        if (!s) continue;
        counterScore += COUNTER_POINTS[s];
        reasons.push(`ชนะทาง ${e.nameTh} (ระดับ${LEVEL_TH[s]})`);
      }
      if (counterScore > 0) {
        score += Math.min(counterScore, COUNTER_CAP);
        tags.push("counter");
      }

      // 2) โดนศัตรูที่เลือกแล้วชนะทาง → หักคะแนนและเตือน
      for (const e of enemies) {
        const s = rel.counterOf.get(`${h.id}>${e.id}`);
        if (!s) continue;
        score -= COUNTER_POINTS[s];
        warnings.push(`${e.nameTh} ชนะทางตัวนี้ (ระดับ${LEVEL_TH[s]})`);
      }

      // 3) คอมโบกับเพื่อนร่วมทีม
      for (const t of mine) {
        if (!rel.synergy.has(`${h.id}|${t.id}`)) continue;
        score += SYNERGY_POINTS;
        reasons.push(`คอมโบกับ ${t.nameTh}`);
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
      return { hero: h, score, stars, reasons, warnings, tags, risk };
    });

  return scored
    .sort((a, b) => b.score - a.score || b.hero.stat.winRate - a.hero.stat.winRate)
    .slice(0, ctx.limit ?? DEFAULT_LIMIT);
}
