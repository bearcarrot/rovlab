import { useCallback, useState } from "react";
import type { HeroLane, HeroRole, HeroSummary } from "@/types/hero";
import { LaneFilterRow, RoleFilterRow } from "./HeroFilters";

/** state + predicate สำหรับกรองรายชื่อฮีโร่ตามตำแหน่ง (role) และเลน */
export function useHeroFilters() {
  const [role, setRole] = useState<HeroRole | null>(null);
  const [lane, setLane] = useState<HeroLane | null>(null);
  const match = useCallback(
    (h: HeroSummary) => (role === null || h.role === role) && (lane === null || h.lane === lane),
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
