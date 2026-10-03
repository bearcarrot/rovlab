import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { BalanceIcon } from "@/features/balance/BalanceIcon";
import { useRecentBalance } from "@/features/balance/useRecentBalance";
import { useFilterLabels } from "@/features/heroes/HeroFilters";
import { heroRoles } from "@/lib/heroPositions";
import type { HeroSummary } from "@/types/hero";

export function HeroCard({
  hero,
  metric = "winRate",
  compact = false,
}: {
  hero: HeroSummary;
  metric?: "winRate" | "banRate";
  /** โหมดย่อ: โชว์แค่ชื่อฮีโร่ (ไม่แสดงตำแหน่งและ WR/BR) */
  compact?: boolean;
}) {
  const recent = useRecentBalance();
  const balance = recent?.get(hero.id);
  const { roleLabel } = useFilterLabels();

  return (
    <Link
      to={`/heroes/${hero.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-bg-surface transition-colors hover:border-accent/40"
    >
      <div className="relative aspect-square bg-bg-raised">
        <div className="absolute left-1.5 top-1.5">
          {hero.stat.hasStats ? <Badge tier={hero.stat.tier}>{hero.stat.tier}</Badge> : <Badge>N/A</Badge>}
        </div>
        <FavoriteButton heroSlug={hero.slug} className="absolute right-1.5 top-1.5" />
        {balance && (
          <span className="absolute bottom-1.5 left-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-bg-surface/90 shadow">
            <BalanceIcon kind={balance} className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="flex h-full items-center justify-center text-2xl font-display text-text-faint">
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
        </div>
      </div>
      {compact ? (
        <div className="p-2">
          <p className="truncate text-center font-display text-sm font-medium leading-tight">{hero.nameTh}</p>
        </div>
      ) : (
        <div className="space-y-1 p-2.5">
          <p className="truncate font-display text-sm font-medium leading-tight">{hero.nameTh}</p>
          <p className="truncate text-xs text-text-faint">{heroRoles(hero).map((r) => roleLabel(r)).join(" · ")}</p>
          <p className="text-xs text-text-muted">
            {hero.stat.hasStats
              ? metric === "banRate"
                ? `BR ${hero.stat.banRate.toFixed(1)}%`
                : `WR ${hero.stat.winRate.toFixed(1)}%`
              : "ยังไม่มีสถิติ"}
          </p>
        </div>
      )}
    </Link>
  );
}
