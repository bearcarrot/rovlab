import { Link } from "react-router-dom";
import { BalanceBadge, HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { HeroIcon } from "@/components/HeroIcon";
import { cn } from "@/lib/utils";
import type { BalanceKind } from "@/services/balance";
import type { HeroSummary } from "@/types/hero";

// หลอดแสดงสัดส่วนจาก 100% (เช่น WR 54.8% = หลอด 54.8% ไม่ใช่เทียบกับอันดับ 1)
// tone ใช้บนหน้า Home: success = Win Rate (เขียว) · danger = Ban Rate (แดง = ควรแบน) · default = ทอง
export type StatTone = "default" | "success" | "danger";

const TONE_STYLES: Record<StatTone, { hover: string; text: string; bar: string }> = {
  default: { hover: "hover:border-accent/40", text: "text-text-muted", bar: "bg-accent" },
  success: { hover: "hover:border-win/50", text: "font-medium text-win", bar: "bg-win" },
  danger: { hover: "hover:border-loss/50", text: "font-medium text-loss-fg", bar: "bg-loss" },
};

export function StatBarRow({
  hero,
  metric,
  tone = "default",
  rank,
  balanceKind,
}: {
  hero: HeroSummary;
  metric: number;
  tone?: StatTone;
  /** อันดับ (1 = แรก) แสดงเป็นเลขนำหน้าแถว; ไม่ส่ง = ไม่แสดง (หน้าอื่นใช้เหมือนเดิม) */
  rank?: number;
  /** หน้าที่โหลด recent balance ไว้แล้วส่ง kind (หรือ null = ไม่มี) มาให้ แถวจะไม่สร้าง hook ของตัวเอง; ไม่ส่ง (undefined) = แถวโหลดเอง */
  balanceKind?: BalanceKind | null;
}) {
  const pct = Math.min(100, Math.max(0, metric));
  const styles = TONE_STYLES[tone];
  return (
    <Link
      to={`/heroes/${hero.slug}`}
      className={cn("flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-2.5", styles.hover)}
    >
      {rank !== undefined && (
        <span
          className={cn(
            "w-5 shrink-0 text-center font-display text-sm font-semibold tabular-nums",
            rank === 1 ? "text-accent" : rank <= 3 ? "text-text" : "text-text-faint"
          )}
        >
          {rank}
        </span>
      )}
      {/* ไม่ใส่ overflow-hidden ที่กรอบนี้ เพราะ badge ต้องโผล่ขอบขวาล่าง → HeroIcon ตัดมุมที่ตัวรูปเอง */}
      <div className="relative h-9 w-9 shrink-0">
        <HeroIcon
          icon={hero.icon}
          name={hero.nameTh}
          fallback={hero.name.slice(0, 2).toUpperCase()}
          className="h-9 w-9 text-2xl"
        />
        {/* ไอคอนปรับสมดุล ขวาล่างของรูปฮีโร่ เหมือนทุกหน้า */}
        {balanceKind !== undefined ? <BalanceBadge kind={balanceKind} /> : <HeroBalanceBadge heroId={hero.id} />}
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
