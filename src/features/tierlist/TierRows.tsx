import { HeroIcon } from "@/components/HeroIcon";
import { Badge } from "@/components/ui/badge";
import type { HeroSummary, Tier } from "@/types/hero";
import { TIER_KEYS, type TierData } from "./tierData";

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
  const rows = TIER_KEYS.map((t) => ({ t, heroes: data[t].map((id) => byId.get(id)).filter((h): h is HeroSummary => !!h) })).filter(
    (r) => r.heroes.length > 0
  );
  if (rows.length === 0) return <p className="text-xs text-text-faint">ยังไม่มีฮีโร่ใน Tier List นี้</p>;
  return (
    <div className="space-y-1.5">
      {rows.map(({ t, heroes }) => {
        const shown = maxPerTier ? heroes.slice(0, maxPerTier) : heroes;
        return (
          <div key={t} className="flex items-start gap-2">
            <Badge tier={t as Tier} className="w-8 shrink-0 self-stretch text-sm">{t}</Badge>
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
