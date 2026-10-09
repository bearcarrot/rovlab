import { useMemo } from "react";
import { getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import type { HeroLane, HeroRole, HeroSummary } from "@/types/hero";

// ต้องตรงกับคีย์ตัวกรองใน pages/Heroes.tsx (อ่านอย่างเดียว ไม่เขียนทับ)
const ROLE_KEY = "rovlab:filter:heroes:role";
const LANE_KEY = "rovlab:filter:heroes:lane";

export type HeroNeighbors = {
  prev: HeroSummary;
  next: HeroSummary;
  /** ลำดับของฮีโร่ปัจจุบันในรายการ (เริ่มที่ 0) */
  index: number;
  total: number;
  /** ตัวกรองที่ใช้อยู่จริง (null = ไม่ได้กรอง หรือกลับไปใช้ทั้งหมด) */
  role: HeroRole | null;
  lane: HeroLane | null;
};

// หาฮีโร่ก่อนหน้า/ถัดไปของ slug นี้ ตามตัวกรองตำแหน่ง/เลนที่เลือกไว้ในหน้ารายชื่อฮีโร่ (เรียง A-Z วนต้น-ท้าย)
// ถ้าฮีโร่ตัวนี้ไม่อยู่ในตัวกรอง (เช่น เข้าจากลิงก์คอมโบ/ลิงก์แชร์) จะใช้รายชื่อทั้งหมดแทน
export function useHeroNeighbors(slug: string): HeroNeighbors | null {
  const heroes = useAsync(() => getHeroes(), []);
  const [role] = usePersistedState<HeroRole | null>(ROLE_KEY, null);
  const [lane] = usePersistedState<HeroLane | null>(LANE_KEY, null);
  const all = heroes.status === "success" ? heroes.data : null;

  return useMemo(() => {
    if (!all) return null;
    const filtered = all.filter(
      (h) => (role === null || heroRoles(h).includes(role)) && (lane === null || heroLanes(h).includes(lane)),
    );
    const inFilter = filtered.some((h) => h.slug === slug);
    const list = inFilter ? filtered : all;
    const index = list.findIndex((h) => h.slug === slug);
    if (index === -1 || list.length < 2) return null;
    return {
      prev: list[(index - 1 + list.length) % list.length],
      next: list[(index + 1) % list.length],
      index,
      total: list.length,
      role: inFilter ? role : null,
      lane: inFilter ? lane : null,
    };
  }, [all, role, lane, slug]);
}
