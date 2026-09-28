import { Link } from "react-router-dom";
import type { HeroSummary } from "@/types/hero";

export function StatBarRow({ hero, metric, maxValue }: { hero: HeroSummary; metric: number; maxValue: number }) {
  const pct = maxValue > 0 ? (metric / maxValue) * 100 : 0;
  return (
    <Link
      to={`/heroes/${hero.slug}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-2.5 hover:border-accent/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-raised font-display text-xs text-text-faint">
        {hero.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{hero.nameTh}</p>
          <p className="shrink-0 text-xs text-text-muted">{metric.toFixed(1)}%</p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}
