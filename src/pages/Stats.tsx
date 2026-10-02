import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { LaneFilterRow } from "@/features/heroes/HeroFilters";
import { StatBarRow } from "@/features/stats/StatBarRow";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { cn } from "@/lib/utils";
import { RANK_LABEL, useRank } from "@/lib/rank";
import type { HeroLane } from "@/types/hero";

type Metric = "winRate" | "pickRate" | "banRate";

const METRIC_LABEL: Record<Metric, string> = {
  winRate: "Win Rate",
  pickRate: "Pick Rate",
  banRate: "Ban Rate",
};

export function Stats() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const rank = useRank();
  const [metric, setMetric] = useState<Metric>("winRate");
  const [lane, setLane] = useState<HeroLane | null>(null);

  const sorted = useMemo(() => {
    if (heroesQ.status !== "success") return [];
    const filtered = heroesQ.data.filter((h) => h.stat.hasStats && (lane === null || h.lane === lane));
    return [...filtered].sort((a, b) => b.stat[metric] - a.stat[metric]);
  }, [heroesQ, lane, metric]);

  const patchLabel = heroesQ.status === "success" ? heroesQ.data.find((h) => h.stat.hasStats)?.stat.patch ?? "—" : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">สถิติ</h1>
        <span className="text-xs text-text-faint">Patch {patchLabel} · {RANK_LABEL[rank]}</span>
      </div>

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

      <LaneFilterRow value={lane} onChange={setLane} />

      {heroesQ.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      )}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && sorted.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title={heroesQ.data.some((h) => h.stat.hasStats) ? "ไม่พบข้อมูลในหมวดนี้" : "ยังไม่มีข้อมูลสถิติ"}
          description={heroesQ.data.some((h) => h.stat.hasStats) ? "ลองเปลี่ยนตัวกรอง Lane" : "ยังไม่มีสถิติสำหรับช่วงแรงก์ที่เลือก"}
        />
      )}
      {heroesQ.status === "success" && sorted.length > 0 && (
        <div className="space-y-2">
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
