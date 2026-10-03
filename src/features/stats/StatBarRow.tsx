import { Link } from "react-router-dom";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import type { HeroSummary } from "@/types/hero";

// หลอดแสดงสัดส่วนจาก 100% (เช่น WR 54.8% = หลอด 54.8% ไม่ใช่เทียบกับอันดับ 1)
export function StatBarRow({ hero, metric }: { hero: HeroSummary; metric: number }) {
  const pct = Math.min(100, Math.max(0, metric));
  return (
    <Link
      to={`/heroes/${hero.slug}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-2.5 hover:border-accent/40"
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-raised font-display text-xs text-text-faint">
        {hero.icon ? (
    <img
      src={hero.icon}
      alt={hero.nameTh}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        e.currentTarget.nextElementSibling?.classList.remove("hidden");
      }}
    />
  ) : null}

  <span className={`text-2xl font-display text-text-faint ${hero.icon ? "hidden" : ""}`}>
    {hero.name.slice(0, 2).toUpperCase()}
  </span>
        {/* ไอคอนปรับสมดุล ขวาล่างของรูปฮีโร่ เหมือนทุกหน้า */}
        <HeroBalanceBadge heroId={hero.id} />
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
