import { MOCK_MATCHUPS } from "@/data/matchups.mock";
import type { MatchupCounterNote, MatchupDetail } from "@/types/matchup";
import type { HeroSummary } from "@/types/hero";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ลำดับการหาข้อมูลของคู่ A vs B:
//  1) ตาราง matchups (แผนเล่นที่แอดมินเขียนไว้ source = curated) ดูได้ทั้งสองทิศทางของคู่
//     แผนเขียนจากมุมมองของ hero_a เสมอ ถ้ามีแค่ทิศตรงข้ามกับที่ผู้ใช้เลือก จะคืน planFor บอกมุมมองจริง
//  2) ถ้าไม่มี → สร้างผลแบบ heuristic ที่มีเฉพาะสิ่งที่มีจริง: Win Rate รวมของแต่ละตัว + ความสัมพันธ์ชนะทางจาก hero_counters
//     (ช่อง early/mid/late/winCondition/tips ปล่อยว่าง หน้าเว็บจะไม่แสดงหัวข้อที่ไม่มีข้อมูล แทนการเขียนว่า "ยังไม่มีข้อมูล" ซ้ำหลายบรรทัด)
// ความสัมพันธ์ชนะทางแนบมากับผลทุกแบบ ใช้แสดงบนหน้าและส่งให้ Coach Ai เป็นข้อมูลอ้างอิง
// ถ้ายังไม่ได้ตั้งค่า Supabase (เช่นรัน dev โดยไม่มี .env) ใช้ข้อมูลตัวอย่างจาก matchups.mock

const SIMULATED_LATENCY = 250;
function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), SIMULATED_LATENCY));
}

function key(a: string, b: string) {
  return [a, b].sort().join("__");
}

function statSummary(a: HeroSummary, b: HeroSummary): string {
  if (!a.stat.hasStats || !b.stat.hasStats) return "";
  const gap = a.stat.winRate - b.stat.winRate;
  const tail = Math.abs(gap) < 0.5 ? "ใกล้เคียงกัน" : `${(gap > 0 ? a : b).nameTh} สูงกว่า`;
  return (
    `Win Rate รวมของแต่ละตัว (แพตช์ ${a.stat.patch}): ${a.nameTh} ${a.stat.winRate.toFixed(1)}% · ` +
    `${b.nameTh} ${b.stat.winRate.toFixed(1)}% — ${tail} (เป็นสถิติรวมของฮีโร่ ไม่ใช่ผลเจอกันโดยตรง)`
  );
}

function heuristicMatchup(a: HeroSummary, b: HeroSummary, counterNotes: MatchupCounterNote[]): MatchupDetail {
  return {
    heroA: a.slug,
    heroB: b.slug,
    lane: a.lane === b.lane ? a.lane : `${a.lane}/${b.lane}`,
    difficulty: a.difficulty === "hard" || b.difficulty === "hard" ? "ยาก" : a.difficulty === "medium" || b.difficulty === "medium" ? "ปานกลาง" : "ง่าย",
    early: "",
    mid: "",
    late: "",
    winCondition: "",
    tips: "",
    summary: statSummary(a, b),
    counterNotes,
    source: "heuristic",
  };
}

type DbMatchupRow = {
  hero_a_id: string;
  hero_b_id: string;
  lane: string;
  difficulty: MatchupDetail["difficulty"];
  early: string | null;
  mid: string | null;
  late: string | null;
  win_condition: string | null;
  tips: string | null;
  source: MatchupDetail["source"];
};

type DbCounterRow = {
  hero_id: string; // ฮีโร่ที่โดนเคาน์เตอร์
  counter_hero_id: string; // ฮีโร่ที่ชนะทาง
  strength: MatchupCounterNote["strength"];
  reason: string | null;
  lane_tip: string | null;
};

const STRENGTH_ORDER: Record<MatchupCounterNote["strength"], number> = { best: 0, good: 1, situational: 2 };

export async function getMatchup(a: HeroSummary, b: HeroSummary): Promise<MatchupDetail> {
  if (!isSupabaseConfigured) {
    const mock = MOCK_MATCHUPS[key(a.slug, b.slug)];
    return delay(mock ? { ...mock, planFor: mock.heroA } : heuristicMatchup(a, b, []));
  }

  const [matchupRes, counterRes] = await Promise.all([
    supabase
      .from("matchups")
      .select("hero_a_id, hero_b_id, lane, difficulty, early, mid, late, win_condition, tips, source")
      .or(`and(hero_a_id.eq.${a.id},hero_b_id.eq.${b.id}),and(hero_a_id.eq.${b.id},hero_b_id.eq.${a.id})`)
      .limit(2),
    supabase
      .from("hero_counters")
      .select("hero_id, counter_hero_id, strength, reason, lane_tip")
      .or(`and(hero_id.eq.${a.id},counter_hero_id.eq.${b.id}),and(hero_id.eq.${b.id},counter_hero_id.eq.${a.id})`),
  ]);
  if (matchupRes.error) throw new Error(matchupRes.error.message);

  // ความสัมพันธ์ชนะทางอ่านไม่ได้ = แค่ไม่มีส่วนนี้ ไม่ทำให้ทั้งหน้าพัง
  const slugById = new Map([[a.id, a.slug], [b.id, b.slug]]);
  const counterNotes: MatchupCounterNote[] = ((counterRes.data ?? []) as unknown as DbCounterRow[])
    .map((c) => ({
      winner: slugById.get(c.counter_hero_id) ?? "",
      loser: slugById.get(c.hero_id) ?? "",
      strength: c.strength,
      reason: (c.reason ?? "").trim(),
      laneTip: (c.lane_tip ?? "").trim(),
    }))
    .filter((n) => n.winner && n.loser)
    .sort((x, y) => STRENGTH_ORDER[x.strength] - STRENGTH_ORDER[y.strength]);

  const rows = (matchupRes.data ?? []) as unknown as DbMatchupRow[];
  // ถ้าแอดมินกรอกไว้ทั้งสองทิศทาง ใช้ทิศที่ตรงกับที่ผู้ใช้เลือก (A = ฮีโร่ของเรา)
  const row = rows.find((r) => r.hero_a_id === a.id) ?? rows[0];
  if (!row) return heuristicMatchup(a, b, counterNotes);

  return {
    heroA: a.slug,
    heroB: b.slug,
    lane: row.lane,
    difficulty: row.difficulty,
    early: row.early ?? "",
    mid: row.mid ?? "",
    late: row.late ?? "",
    winCondition: row.win_condition ?? "",
    tips: row.tips ?? "",
    source: row.source,
    // แผนเขียนจากมุมมองของ hero_a ของแถวนั้น
    planFor: row.hero_a_id === a.id ? a.slug : b.slug,
    counterNotes,
  };
}
