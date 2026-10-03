import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import type { HeroLane, HeroRole, HeroSummary } from "@/types/hero";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { usePersistedState } from "@/hooks/usePersistedState";
import { LaneFilterRow, RoleFilterRow } from "./HeroFilters";

/**
 * state + predicate สำหรับกรองรายชื่อฮีโร่ตามตำแหน่ง (role) และเลน — ฮีโร่ที่ไปได้หลายตำแหน่ง/เลนจะขึ้นในทุกตัวกรองที่ตรง
 * ค่าที่เลือกถูกจำไว้ต่อหน้า (ตาม path) เพื่อให้รอดตอนสลับแรงก์ (หน้า remount) และตอนรีเฟรช
 * หน้าที่มีตัวกรองหลายชุด (เช่น Matchup ฝั่งเรา/ศัตรู) ส่ง scope ต่างกันเพื่อให้จำแยกกัน
 */
export function useHeroFilters(scope = "main") {
  const { pathname } = useLocation();
  const base = `rovlab:filter:hero:${pathname}:${scope}`;
  const [role, setRole] = usePersistedState<HeroRole | null>(`${base}:role`, null);
  const [lane, setLane] = usePersistedState<HeroLane | null>(`${base}:lane`, null);
  const match = useCallback(
    (h: HeroSummary) =>
      (role === null || heroRoles(h).includes(role)) && (lane === null || heroLanes(h).includes(lane)),
    [role, lane]
  );
  return { role, lane, setRole, setLane, match };
}

export function HeroFilterBar({
  role,
  lane,
  onRole,
  onLane,
}: {
  role: HeroRole | null;
  lane: HeroLane | null;
  onRole: (v: HeroRole | null) => void;
  onLane: (v: HeroLane | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <RoleFilterRow value={role} onChange={onRole} />
      <LaneFilterRow value={lane} onChange={onLane} />
    </div>
  );
}
