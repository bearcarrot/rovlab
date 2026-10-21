import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import type { HeroSummary } from "@/types/hero";
import type { CustomTierMap } from "./customTier";
import { CustomTierChip } from "./CustomTierChip";

// ปุ่มฮีโร่ในกล่องเลือกของ Draft Assistant
// memo ไว้เพื่อให้กริด ~100+ ใบไม่เรนเดอร์ใหม่ทุกครั้งที่ state อื่นในหน้าเปลี่ยน (ต้องส่ง onSelect และ customTiers ที่คงที่ ไม่งั้น memo ไม่ช่วย)
// customTiers: เทียร์จาก "Tier List ของฉัน" ที่ผู้ใช้เลือก (null/ไม่ส่ง = ใช้เทียร์จากสถิติเหมือนเดิม)
function HeroPickButtonBase({
  hero: h,
  onSelect,
  customTiers,
}: {
  hero: HeroSummary;
  onSelect: (hero: HeroSummary) => void;
  customTiers?: CustomTierMap | null;
}) {
  const ct = customTiers ? customTiers.get(h.id) : undefined;
  return (
    <button
      type="button"
      onClick={() => onSelect(h)}
      className="flex flex-col items-center gap-1 overflow-hidden rounded-lg border border-border bg-bg p-0 pb-1 text-center hover:border-accent/40"
    >
      <div className="relative flex aspect-square w-full items-center justify-center bg-bg-raised text-xs font-display text-text-faint">
        {h.icon ? (
          <img
            src={h.icon}
            alt={h.nameTh}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}

        <span className={`text-sm font-display text-text-faint sm:text-base ${h.icon ? "hidden" : ""}`}>
          {h.name.slice(0, 2).toUpperCase()}
        </span>
        {/* Tier มุมซ้ายบน และไอคอน buff/nerf/rework มุมขวาล่างแบบเดียวกับการ์ดในหน้าฮีโร่ทั้งหมด */}
        <div className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)]">
          {customTiers ? (
            ct ? (
              <CustomTierChip tier={ct} />
            ) : (
              <Badge>—</Badge>
            )
          ) : h.stat.hasStats ? (
            <Badge tier={h.stat.tier}>{h.stat.tier}</Badge>
          ) : (
            <Badge>N/A</Badge>
          )}
        </div>
        <HeroBalanceBadge heroId={h.id} size="md" inside />
      </div>
      <span className="w-full truncate px-1 text-[11px] leading-tight sm:text-xs">{h.nameTh}</span>
    </button>
  );
}

export const HeroPickButton = memo(HeroPickButtonBase);
