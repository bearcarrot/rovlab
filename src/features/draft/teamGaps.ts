import type { HeroSummary } from "@/types/hero";
import type { TeamAnalysis } from "./analyzeTeam";
import type { KitsByHero } from "./skillTags";

// จุดที่ทีมยังขาด — ใช้เกณฑ์เดียวกับที่ recommendPicks ใช้เติมจุดอ่อน (frontline < 3, cc < 3)
// เพื่อให้ข้อความ "ขาดอะไร" ตรงกับเหตุผลที่ระบบแนะนำฮีโร่ตัวถัดไป
export interface TeamGap {
  key: string;
  label: string;
  detail: string;
}

const FRONTLINE_MIN = 3;
const CC_MIN = 3;
const SKEW_RATIO = 0.2; // ดาเมจฝั่งที่น้อยกว่าต่ำกว่า 20% ของทั้งหมด = เอนเอียง
const SKEW_MIN_HEROES = 3; // ฮีโร่น้อยกว่านี้ยังไม่ตัดสินว่าเอนเอียง (ยังเลือกไม่ครบ)

export function findTeamGaps(analysis: TeamAnalysis, team: (HeroSummary | null)[], kits?: KitsByHero): TeamGap[] {
  const picked = team.filter((h): h is HeroSummary => h !== null);
  if (picked.length === 0) return [];
  const gaps: TeamGap[] = [];

  const { physicalDamage: phys, magicDamage: mag } = analysis;
  const total = phys + mag;
  if (total > 0) {
    if (phys === 0) {
      gaps.push({ key: "physical", label: "ดาเมจกายภาพ", detail: "ทีมมีแต่ดาเมจเวท ศัตรูที่ออกของกันเวทจะเล่นง่ายขึ้น" });
    } else if (mag === 0) {
      gaps.push({ key: "magic", label: "ดาเมจเวท", detail: "ทีมมีแต่ดาเมจกายภาพ ศัตรูที่ออกของกันกายภาพจะเล่นง่ายขึ้น" });
    } else if (picked.length >= SKEW_MIN_HEROES && Math.min(phys, mag) / total < SKEW_RATIO) {
      const weak = phys < mag ? "กายภาพ" : "เวท";
      gaps.push({ key: "skew", label: `ดาเมจ${weak}น้อย`, detail: `ดาเมจเอนเอียงไปอีกฝั่งมาก ลองเพิ่มฮีโร่ดาเมจ${weak}` });
    }
  }

  if (analysis.frontline < FRONTLINE_MIN) {
    gaps.push({ key: "frontline", label: "แนวหน้า", detail: "ยังไม่มีตัวรับหน้า/เปิดไฟต์พอ" });
  }
  if (analysis.cc < CC_MIN) {
    gaps.push({ key: "cc", label: "Crowd Control", detail: "คุมฝูงชน (สตั๊น/ลอยขึ้น/ผลัก ฯลฯ) ยังน้อย ล็อกเป้าได้ยาก" });
  }

  // ฮีล/โล่ มาจากแท็กสกิลเท่านั้น: รายงานเฉพาะเมื่อทุกตัวในทีมมีข้อมูลแท็ก
  // ไม่งั้นแยกไม่ออกว่า "ไม่มี" หรือ "ยังไม่ได้นำเข้าข้อมูล" แล้วจะแจ้งผิด
  const allHaveKit = picked.every((h) => kits?.[h.id]);
  if (allHaveKit && analysis.healShield === 0) {
    gaps.push({ key: "sustain", label: "ฮีล / โล่", detail: "ไม่มีฮีโร่ในทีมที่สกิลมีฮีลหรือโล่" });
  }

  return gaps;
}
