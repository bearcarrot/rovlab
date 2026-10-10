import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { useFilterLabels } from "@/features/heroes/HeroFilters";
import { heroRoles } from "@/lib/heroPositions";
import type { HeroSummary } from "@/types/hero";

export function HeroCard({
  hero,
  metric = "winRate",
  compact = false,
  hideRoles = false,
}: {
  hero: HeroSummary;
  metric?: "winRate" | "banRate";
  /** โหมดย่อ: โชว์แค่ชื่อฮีโร่ (ไม่แสดงตำแหน่งและ WR/BR) */
  compact?: boolean;
  /** ซ่อนบรรทัดตำแหน่ง แต่ยังแสดงชื่อและ WR/BR (ใช้ในหน้าหลัก) */
  hideRoles?: boolean;
}) {
  const { roleLabel } = useFilterLabels();

  // ปุ่มหัวใจวางเป็นพี่น้องของ <Link> (ไม่ใช่ลูก) เพราะ <button> ซ้อนใน <a> เป็น HTML ที่ไม่ถูกต้องและกระทบ screen reader/คีย์บอร์ด
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-bg-surface transition-colors hover:border-accent/40">
      <Link to={`/heroes/${hero.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square bg-bg-raised">
          <div className="absolute left-1.5 top-1.5">
            {hero.stat.hasStats ? <Badge tier={hero.stat.tier}>{hero.stat.tier}</Badge> : <Badge>N/A</Badge>}
          </div>
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
          {/* ขวาล่างเหมือนทุกหน้า (การ์ด overflow-hidden จึงวางชิดใน) */}
          <HeroBalanceBadge heroId={hero.id} size="md" inside />
        </div>
        {/* ชื่อฮีโร่ใช้ฟอนต์ปกติ น้ำหนักปกติ (font-normal) ไม่ใช้ font-display
            โหมด compact ใช้ขนาดตัวอักษร/ระยะห่างเท่าการ์ดในหน้า Counter Pick (text-[11px] sm:text-xs) */}
        {compact ? (
          <div className="px-1 py-1">
            <p className="truncate text-center text-[11px] font-normal leading-tight sm:text-xs">{hero.nameTh}</p>
          </div>
        ) : (
          <div className="space-y-1 p-2.5">
            <p className="truncate text-sm font-normal leading-tight">{hero.nameTh}</p>
            {!hideRoles && (
              <p className="truncate text-xs text-text-faint">{heroRoles(hero).map((r) => roleLabel(r)).join(" · ")}</p>
            )}
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
      <FavoriteButton heroSlug={hero.slug} className="absolute right-1.5 top-1.5 z-10" />
    </div>
  );
}
