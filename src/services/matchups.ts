import { MOCK_MATCHUPS } from "@/data/matchups.mock";
import type { MatchupDetail } from "@/types/matchup";
import type { HeroSummary } from "@/types/hero";

const SIMULATED_LATENCY = 250;
function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), SIMULATED_LATENCY));
}

function key(a: string, b: string) {
  return [a, b].sort().join("__");
}

function heuristicMatchup(a: HeroSummary, b: HeroSummary): MatchupDetail {
  const bothHaveStats = a.stat.hasStats && b.stat.hasStats;
  const favored = a.stat.winRate >= b.stat.winRate ? a : b;
  const other = favored.slug === a.slug ? b : a;
  return {
    heroA: a.slug,
    heroB: b.slug,
    lane: a.lane === b.lane ? a.lane : `${a.lane}/${b.lane}`,
    difficulty: a.difficulty === "hard" || b.difficulty === "hard" ? "ยาก" : a.difficulty === "medium" || b.difficulty === "medium" ? "ปานกลาง" : "ง่าย",
    early: bothHaveStats
      ? `ข้อมูลเจาะจงคู่นี้ยังไม่มี แต่จาก Win Rate ปัจจุบัน ${favored.nameTh} (${favored.stat.winRate.toFixed(1)}%) ได้เปรียบกว่า ${other.nameTh} (${other.stat.winRate.toFixed(1)}%) เล็กน้อย`
      : "ยังไม่มีข้อมูลเจาะจงหรือสถิติสำหรับคู่นี้ในตอนนี้",
    mid: "ยังไม่มีข้อมูลเจาะจงช่วงกลางเกมสำหรับคู่นี้",
    late: "ยังไม่มีข้อมูลเจาะจงช่วงปลายเกมสำหรับคู่นี้",
    winCondition: "ยังไม่มีข้อมูลเจาะจง — ใช้หลักทั่วไปของ Role แต่ละฝั่งไปก่อน",
    tips: "เพิ่มข้อมูลคู่นี้จะช่วยให้คำแนะนำแม่นยำขึ้นในเวอร์ชันถัดไป",
    source: "heuristic",
  };
}

export async function getMatchup(a: HeroSummary, b: HeroSummary): Promise<MatchupDetail> {
  // TODO(supabase): supabase.from("matchups").select(...) by hero pair
  return delay(MOCK_MATCHUPS[key(a.slug, b.slug)] ?? heuristicMatchup(a, b));
}
