import { HeroIcon } from "@/components/HeroIcon";
import { readableTextColor } from "@/lib/readableText";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";
import type { TierData, TierRow } from "./tierData";

/** Colored label block of a tier row (user-defined label + color). */
export function TierLabel({ row, className }: { row: Pick<TierRow, "label" | "color">; className?: string }) {
  const n = row.label.length;
  return (
    <span
      style={{ backgroundColor: row.color, color: readableTextColor(row.color) }}
      className={cn(
        "inline-flex items-center justify-center break-all rounded-md px-1 text-center font-semibold leading-tight",
        n <= 2 ? "text-base" : n <= 5 ? "text-sm" : "text-xs",
        className
      )}
    >
      {row.label}
    </span>
  );
}

/** Read-only tier rows (used by My Tier Lists cards and the Community view). Unknown hero ids are skipped. */
export function TierRows({
  data,
  byId,
  size = "md",
  maxPerTier,
}: {
  data: TierData;
  byId: Map<string, HeroSummary>;
  size?: "sm" | "md";
  maxPerTier?: number;
}) {
  const icon = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const rows = data
    .map((row) => ({ row, heroes: row.heroes.map((id) => byId.get(id)).filter((h): h is HeroSummary => !!h) }))
    .filter((r) => r.heroes.length > 0);
  if (rows.length === 0) return <p className="text-xs text-text-faint">ยังไม่มีฮีโร่ใน Tier List นี้</p>;
  return (
    <div className="space-y-1.5">
      {rows.map(({ row, heroes }) => {
        const shown = maxPerTier ? heroes.slice(0, maxPerTier) : heroes;
        return (
          <div key={row.id} className="flex items-start gap-2">
            <TierLabel row={row} className={cn("shrink-0 self-stretch", size === "sm" ? "w-9" : "w-12")} />
            <div className="flex flex-1 flex-wrap gap-1">
              {shown.map((h) => (
                <HeroIcon key={h.id} icon={h.icon} name={h.name} className={`${icon} rounded-md`} />
              ))}
              {shown.length < heroes.length && <span className="self-center text-xs text-text-faint">+{heroes.length - shown.length}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
