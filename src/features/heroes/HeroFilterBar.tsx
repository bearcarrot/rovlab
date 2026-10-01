import { useCallback, useState } from "react";
import type { HeroLane, HeroRole, HeroSummary } from "@/types/hero";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { LaneFilterRow, RoleFilterRow } from "./HeroFilters";

/** state + predicate สำหรับกรองรายชื่อฮีโร่ตามตำแหน่ง (role) และเลน — ฮีโร่ที่ไปได้หลายตำแหน่ง/เลนจะขึ้นในทุกตัวกรองที่ตรง */
export function useHeroFilters() {
  const [role, setRole] = useState<HeroRole | null>(null);
  const [lane, setLane] = useState<HeroLane | null>(null);
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
