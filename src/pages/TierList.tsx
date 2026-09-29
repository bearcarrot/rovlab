import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { RoleFilterRow, LaneFilterRow } from "@/features/heroes/HeroFilters";
import { tierReason } from "@/features/tierlist/tierReason";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Badge } from "@/components/ui/badge";
import type { HeroLane, HeroRole, Tier } from "@/types/hero";
import { MOCK_PATCH } from "@/data/heroes.mock";

const TIER_ORDER: Tier[] = ["S+", "S", "A", "B", "C"];

export function TierList() {
  const heroes = useAsync(() => getHeroes(), []);
  const [role, setRole] = useState<HeroRole | null>(null);
  const [lane, setLane] = useState<HeroLane | null>(null);

  const grouped = useMemo(() => {
    if (heroes.status !== "success") return null;
    const filtered = heroes.data.filter(
      (h) => h.stat.hasStats && (role === null || h.role === role) && (lane === null || h.lane === lane)
    );
    const map = new Map<Tier, typeof filtered>();
    for (const t of TIER_ORDER) map.set(t, []);
    for (const h of filtered) map.get(h.stat.tier)?.push(h);
    for (const list of map.values()) list.sort((a, b) => b.stat.winRate - a.stat.winRate);
    return map;
  }, [heroes, role, lane]);

  const totalShown = grouped ? [...grouped.values()].reduce((n, l) => n + l.length, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Tier List</h1>
        <span className="text-xs text-text-faint">Patch {MOCK_PATCH} · Diamond+</span>
      </div>

      <div className="space-y-2">
        <RoleFilterRow value={role} onChange={setRole} />
        <LaneFilterRow value={lane} onChange={setLane} />
      </div>

      {heroes.status === "loading" && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}
      {heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}
      {heroes.status === "success" && totalShown === 0 && (
        <EmptyState
          icon={BarChart3}
          title={heroes.data.some((h) => h.stat.hasStats) ? "ไม่พบฮีโร่ในหมวดนี้" : "ยังไม่มีข้อมูลสถิติฮีโร่"}
          description={heroes.data.some((h) => h.stat.hasStats) ? "ลองเปลี่ยนตัวกรอง Role หรือ Lane" : "Tier List จะแสดงผลเมื่อมีการเติมสถิติฮีโร่แล้ว"}
        />
      )}
      {grouped && totalShown > 0 && (
        <div className="space-y-5">
          {TIER_ORDER.filter((t) => (grouped.get(t)?.length ?? 0) > 0).map((tier) => (
            <div key={tier}>
              <div className="mb-2 flex items-center gap-2">
                <Badge tier={tier} className="text-sm px-2.5 py-1">{tier}</Badge>
                <span className="text-xs text-text-faint">{grouped.get(tier)?.length} ฮีโร่</span>
              </div>
              <div className="space-y-2">
                {grouped.get(tier)!.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-card border border-border bg-bg-surface p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-bg-raised font-display text-sm text-text-faint">
                      {h.icon ? (
    <img
      src={h.icon}
      alt={h.nameTh}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        e.currentTarget.nextElementSibling?.classList.remove("hidden");
      }}
    />
  ) : null}

  <span className={`text-2xl font-display text-text-faint ${h.icon ? "hidden" : ""}`}>
    {h.name.slice(0, 2).toUpperCase()}
  </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-display text-sm font-medium">{h.nameTh}</p>
                        <p className="shrink-0 text-xs text-text-muted">WR {h.stat.winRate.toFixed(1)}% · Ban {h.stat.banRate.toFixed(1)}%</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-faint">{tierReason(h)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
