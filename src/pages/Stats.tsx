import { useEffect, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { trackActivity } from "@/services/activity";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Chip, RoleFilterRow, LaneFilterRow } from "@/features/heroes/HeroFilters";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { StatBarRow } from "@/features/stats/StatBarRow";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { cn } from "@/lib/utils";
import { RANK_LABEL, setRank, useRank, type RankBucket } from "@/lib/rank";
import type { HeroLane, HeroRole } from "@/types/hero";

type Metric = "winRate" | "pickRate" | "banRate";

const METRIC_LABEL: Record<Metric, string> = {
  winRate: "Win Rate",
  pickRate: "Pick Rate",
  banRate: "Ban Rate",
};

const RANKS: RankBucket[] = ["all", "high"];

export function Stats() {
  const heroesQ = useAsync(() => getHeroes(), []);
  // แรงก์ใช้ store กลางเดียวกับปุ่มบน Header และหน้า Tier List (lib/rank.ts) — ชิปด้านล่างนี้แค่เรียก setRank ไม่มี state แยก
  const rank = useRank();
  // จำค่าตัวกรองไว้แม้สลับแรงก์ (หน้าถูก remount เมื่อ rank เปลี่ยน)
  const [metric, setMetric] = usePersistedState<Metric>("rovlab:filter:stats:metric", "winRate");
  const [role, setRole] = usePersistedState<HeroRole | null>("rovlab:filter:stats:role", null);
  const [lane, setLane] = usePersistedState<HeroLane | null>("rovlab:filter:stats:lane", null);

  // บันทึกแค่ครั้งเดียวต่อแรงก์ต่อ session (ไม่นับตอนสลับ metric/ตัวกรอง)
  useEffect(() => {
    void trackActivity("stats_viewed", { rank }, { once: true });
  }, [rank]);

  const sorted = useMemo(() => {
    if (heroesQ.status !== "success") return [];
    // ฮีโร่ที่ไปได้หลายตำแหน่ง/เลนต้องขึ้นในทุกตัวกรองที่ตรง (ใช้ roles/lanes ทั้งอาร์เรย์)
    const filtered = heroesQ.data.filter(
      (h) =>
        h.stat.hasStats &&
        (role === null || heroRoles(h).includes(role)) &&
        (lane === null || heroLanes(h).includes(lane))
    );
    return [...filtered].sort((a, b) => b.stat[metric] - a.stat[metric]);
  }, [heroesQ, role, lane, metric]);

  const patchLabel = heroesQ.status === "success" ? heroesQ.data.find((h) => h.stat.hasStats)?.stat.patch ?? "—" : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">สถิติ</h1>
        <span className="text-xs text-text-faint">Patch {patchLabel} · {RANK_LABEL[rank]}</span>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-text-faint">แรงก์</p>
        <div role="group" aria-label="แรงก์" className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {RANKS.map((r) => (
            <Chip key={r} active={rank === r} onClick={() => setRank(r)} label={RANK_LABEL[r]} />
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-text-faint">ตัวชี้วัด</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                metric === m ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted"
              )}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <RoleFilterRow value={role} onChange={setRole} />
        <LaneFilterRow value={lane} onChange={setLane} />
      </div>

      {heroesQ.status === "loading" && (
        <div className="grid gap-2 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      )}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && sorted.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title={heroesQ.data.some((h) => h.stat.hasStats) ? "ไม่พบข้อมูลในหมวดนี้" : "ยังไม่มีข้อมูลสถิติ"}
          description={heroesQ.data.some((h) => h.stat.hasStats) ? "ลองเปลี่ยนตัวกรอง Role หรือ Lane" : "ยังไม่มีสถิติสำหรับช่วงแรงก์ที่เลือก"}
        />
      )}
      {heroesQ.status === "success" && sorted.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {sorted.map((h) => (
            <StatBarRow key={h.id} hero={h} metric={h.stat[metric]} />
          ))}
        </div>
      )}

      <p className="pt-1 text-center text-[11px] text-text-faint">
        * แสดงเฉพาะฮีโร่ที่มีข้อมูลสถิติในช่วงแรงก์ที่เลือก
      </p>
    </div>
  );
}
