import { Link } from "react-router-dom";
import { Swords, GitCompareArrows, Users, Hammer, BookOpen } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getDashboardInsights } from "@/services/insights";
import { useAsync } from "@/hooks/useAsync";
import { HeroCard } from "@/features/heroes/HeroCard";
import { InsightCard } from "@/features/dashboard/InsightCard";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { RANK_LABEL, useRank } from "@/lib/rank";
import type { HeroSummary } from "@/types/hero";

const QUICK_ACTIONS = [
  { to: "/draft", label: "Draft Assist", icon: Users, desc: "ประเมินทีมระหว่างดราฟต์" },
  { to: "/counter-pick", label: "Counter ที่ควรรู้", icon: GitCompareArrows, desc: "หาตัวสวนคู่ต่อสู้" },
  { to: "/build", label: "Build แนะนำ", icon: Hammer, desc: "ไอเทม/Arcana ต่อฮีโร่" },
  { to: "/learn", label: "คู่มือ", icon: BookOpen, desc: "Macro / Micro" },
];

export function Home() {
  const heroes = useAsync(() => getHeroes(), []);
  const insights = useAsync(() => getDashboardInsights(), []);
  const rank = useRank();

  const withStats = heroes.status === "success" ? heroes.data.filter((h) => h.stat.hasStats) : [];
  const patchLabel = withStats[0]?.stat.patch ?? "—";
  const topWinRate = [...withStats].sort((a, b) => b.stat.winRate - a.stat.winRate).slice(0, 6);
  const mostBanned = [...withStats].sort((a, b) => b.stat.banRate - a.stat.banRate).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-card border border-border bg-bg-surface px-4 py-3">
        <div>
          <p className="text-xs text-text-faint">เมต้าตอนนี้ · {RANK_LABEL[rank]}</p>
          <p className="font-display text-sm font-medium">Patch {patchLabel}</p>
        </div>
        <Swords className="h-5 w-5 text-accent" strokeWidth={2} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">ควรปรับปรุงอะไรก่อน</h2>
        {insights.status === "loading" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        )}
        {insights.status === "error" && <ErrorState message={insights.message} onRetry={insights.refetch} />}
        {insights.status === "success" && insights.data.length === 0 && (
          <EmptyState icon={Swords} title="ยังไม่มีข้อมูลให้วิเคราะห์" description="เล่นแมตช์แล้วเชื่อมข้อมูลเพื่อรับคำแนะนำเฉพาะตัว" />
        )}
        {insights.status === "success" && insights.data.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.data.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">ทางลัด</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ to, label, icon: Icon, desc }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col gap-2 rounded-card border border-border bg-bg-surface p-3.5 hover:border-accent/40"
            >
              <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
              <div>
                <p className="font-display text-sm font-medium leading-tight">{label}</p>
                <p className="text-xs text-text-faint">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <HeroRow title="Hero ที่กำลังแรง (Win Rate สูงสุด)" state={heroes} heroes={topWinRate} />
      <HeroRow title="Hero ที่ถูกแบนมากสุด" state={heroes} heroes={mostBanned} />
    </div>
  );
}

type FetchStatus = { status: "loading" | "error" | "success" };

function HeroRow({
  title,
  state,
  heroes,
}: {
  title: string;
  state: FetchStatus;
  heroes: HeroSummary[];
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-semibold">{title}</h2>
      {state.status === "loading" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      )}
      {state.status === "error" && <ErrorState message={"โหลดข้อมูลฮีโร่ไม่สำเร็จ"} />}
      {state.status === "success" && heroes.length === 0 && (
        <EmptyState icon={Swords} title="ไม่มีข้อมูลฮีโร่" description="ยังไม่มีข้อมูลในหมวดนี้" />
      )}
      {state.status === "success" && heroes.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {heroes.map((h) => (
            <HeroCard key={h.id} hero={h} />
          ))}
        </div>
      )}
    </section>
  );
}
