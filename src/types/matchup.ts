export interface MatchupDetail {
  heroA: string;
  heroB: string;
  lane: string;
  difficulty: "ง่าย" | "ปานกลาง" | "ยาก";
  early: string;
  mid: string;
  late: string;
  winCondition: string;
  tips: string;
  source: "curated" | "heuristic";
}
