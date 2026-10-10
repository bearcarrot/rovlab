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
  tile = false,
}: {
  hero: HeroSummary;
  metric?: "winRate" | "banRate";
  /** โหมดย่อ: โชว์แค่ชื่อฮีโร่ (ไม่แสดงตำแหน่งและ WR/BR) */
  compact?: boolean;
  /** ซ่อนบรรทัดตำแหน่ง แต่ยังแสดงชื่อและ WR/BR (ใช้ในหน้าหลัก) */
  hideRoles?: boolean;
  /** หน้าตาเหมือนตัวเลือกฮีโร่ในหน้า Counter Pick: ไอคอนเล็กในกรอบ + ชื่อด้านล่าง (ยังมี Tier และปุ่มโปรดย่อไว้มุมการ์ด) */
  tile?: boolean;
}) {
  const { roleLabel } = useFilterLabels();

  if (tile) {
    // Link เป็นตัวการ์ด ส่วน Tier/ปุ่มหัวใจเป็นพี่น้องของ <Link> (ไม่ซ้อน <button> ใน <a>) วางมุมการ์ดไม่ทับไอคอนตรงกลาง
    return (
      <div className="relative">
        <Link
          to={`/heroes/${hero.slug}`}
          className="flex h-full flex-col items-center gap-1 rounded-lg border border-border bg-bg-surface p-2 text-center transition-colors hover:border-accent/40"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-bg-raised font-display text-xs text-text-faint sm:h-11 sm:w-11">
            {hero.icon ? (
              <img
                src={hero.icon}
                alt={hero.nameTh}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-md object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}

            <span className={`text-sm font-display text-text-faint sm:text-base ${hero.icon ? "hidden" : ""}`}>
              {hero.name.slice(0, 2).toUpperCase()}
            </span>
            <HeroBalanceBadge heroId={hero.id} />
          </div>
          <span className="w-full truncate text-[11px] leading-tight sm:text-xs">{hero.nameTh}</span>
        </Link>
        <div className="pointer-events-none absolute left-0.5 top-0.5 z-10">
          {hero.stat.hasStats ? (
            <Badge tier={hero.stat.tier} className="px-1 py-0 text-[10px] leading-4">{hero.stat.tier}</Badge>
          ) : (
            <Badge className="px-1 py-0 text-[10px] leading-4">N/A</Badge>
          )}
        </div>
        <FavoriteButton
          heroSlug={hero.slug}
          className="absolute right-0.5 top-0.5 z-10 h-5 w-5 [&>svg]:h-3 [&>svg]:w-3"
        />
      </div>
    );
  }

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
        {compact ? (
          <div className="p-2">
            <p className="truncate text-center font-display text-sm font-medium leading-tight">{hero.nameTh}</p>
          </div>
        ) : (
          <div className="space-y-1 p-2.5">
            <p className="truncate font-display text-sm font-medium leading-tight">{hero.nameTh}</p>
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
