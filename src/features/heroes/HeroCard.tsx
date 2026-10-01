import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { heroRoles } from "@/lib/heroPositions";
import type { HeroSummary } from "@/types/hero";

const ROLE_LABEL_TH: Record<string, string> = {
  assassin: "แอสแซสซิน",
  fighter: "ไฟท์เตอร์",
  mage: "เมจ",
  marksman: "มาร์กแมน",
  support: "ซัพพอร์ต",
  tank: "แทงค์",
};

export function HeroCard({ hero }: { hero: HeroSummary }) {
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
      <div className="space-y-1 p-2.5">
        <p className="truncate font-display text-sm font-medium leading-tight">{hero.nameTh}</p>
        <p className="truncate text-xs text-text-faint">{heroRoles(hero).map((r) => ROLE_LABEL_TH[r] ?? r).join(" · ")}</p>
        <p className="text-xs text-text-muted">{hero.stat.hasStats ? `WR ${hero.stat.winRate.toFixed(1)}%` : "ยังไม่มีสถิติ"}</p>
      </div>
    </Link>
  );
}
