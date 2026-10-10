import { Link } from "react-router-dom";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";

// หลอดแสดงสัดส่วนจาก 100% (เช่น WR 54.8% = หลอด 54.8% ไม่ใช่เทียบกับอันดับ 1)
// tone ใช้บนหน้า Home: success = Win Rate (เขียว) · danger = Ban Rate (แดง = ควรแบน) · default = ทอง
export type StatTone = "default" | "success" | "danger";

const TONE_STYLES: Record<StatTone, { hover: string; text: string; bar: string }> = {
  default: { hover: "hover:border-accent/40", text: "text-text-muted", bar: "bg-accent" },
  success: { hover: "hover:border-win/50", text: "font-medium text-win", bar: "bg-win" },
  danger: { hover: "hover:border-loss/50", text: "font-medium text-loss", bar: "bg-loss" },
};

export function StatBarRow({
  hero,
  metric,
  tone = "default",
}: {
  hero: HeroSummary;
  metric: number;
  tone?: StatTone;
}) {
  const pct = Math.min(100, Math.max(0, metric));
  const styles = TONE_STYLES[tone];
  return (
    <Link
      to={`/heroes/${hero.slug}`}
      className={cn("flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-2.5", styles.hover)}
    >
      {/* ไม่ใส่ overflow-hidden ที่กรอบ เพราะ HeroBalanceBadge ต้องโผล่ขอบขวาล่าง → ตัดมุมที่ตัวรูปแทน */}
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-raised font-display text-xs text-text-faint">
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

        <span className={`text-2xl font-display text-text-faint ${hero.icon ? "hidden" : ""}`}>
          {hero.name.slice(0, 2).toUpperCase()}
        </span>
        {/* ไอคอนปรับสมดุล ขวาล่างของรูปฮีโร่ เหมือนทุกหน้า */}
        <HeroBalanceBadge heroId={hero.id} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{hero.nameTh}</p>
          <p className={cn("shrink-0 text-xs", styles.text)}>{metric.toFixed(1)}%</p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
          <div className={cn("h-full rounded-full", styles.bar)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}
