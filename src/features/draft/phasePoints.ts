import type { HeroSummary, PhasePoints } from "@/types/hero";

// แต้มช่วงเกมของฮีโร่ตัวนี้ (ทีมงานกรอกไว้ใน hero_phase_points) — เลือกเลนหลักก่อน ไม่มีค่อยดูเลนอื่นที่ฮีโร่ไปได้
// ถ้าแอดมินกรอกไว้เฉพาะเลนที่ไม่อยู่ในรายการเลนของฮีโร่ ใช้แถวแรกที่มี; ไม่มีข้อมูลเลย = null (ผู้เรียกใช้ heuristic จาก Role)
export function heroPhasePoints(h: Pick<HeroSummary, "lane" | "lanes" | "phase">): PhasePoints | null {
  const p = h.phase;
  if (!p) return null;
  for (const lane of [h.lane, ...(h.lanes ?? [])]) {
    const hit = p[lane];
    if (hit) return hit;
  }
  return Object.values(p)[0] ?? null;
}
