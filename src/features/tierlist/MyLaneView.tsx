import { useCallback, useMemo } from "react";
import { ShareImageButtons } from "@/features/share/ShareImageButtons";
import { useShareImage } from "@/features/share/useShareImage";
import { formatGeneratedDate, makeFilename, tierLaneGridTemplate, type TierLaneGridImageData } from "@/lib/share-image";
import type { HeroSummary } from "@/types/hero";
import type { CustomTierList } from "./customTierList";
import { toShareTiers } from "./laneGrid";
import { LaneGrid, useTierLaneGrid } from "./LaneGrid";

// Read-only lane view of the list being edited (the editor itself is unchanged), with its own lane-grid PNG.
export function MyLaneView({ list, heroes, name, patch }: { list: CustomTierList; heroes: HeroSummary[]; name: string; patch: string }) {
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const { grid, columns, placed } = useTierLaneGrid(list.tiers, byId);
  const buildShare = useCallback(() => {
    const data: TierLaneGridImageData = {
      title: name,
      patch: patch || list.patch || "—",
      filterLabel: "จัดเอง · ตามเลน",
      lanes: columns,
      tiers: toShareTiers(grid),
      generatedDate: formatGeneratedDate(),
    };
    return { data, filename: makeFilename("rovlab-my-tier-list-lanes"), title: name };
  }, [grid, columns, name, patch, list.patch]);
  const share = useShareImage(tierLaneGridTemplate, buildShare);

  return (
    <section aria-label="มุมมองตามเลน" className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
      <h2 className="font-display text-sm font-semibold">มุมมองตามเลน</h2>
      <p className="text-xs text-text-faint">ดูอย่างเดียว · ฮีโร่ที่มีหลายเลนจะอยู่ในทุกเลนของมัน แก้ไขอันดับที่ตัวจัดอันดับด้านล่าง</p>
      {placed === 0 ? (
        <p className="text-xs text-text-faint">เลือกฮีโร่เข้า Tier อย่างน้อย 1 ตัวเพื่อดูตามเลน</p>
      ) : (
        <LaneGrid grid={grid} columns={columns} />
      )}
      <ShareImageButtons busy={share.busy} pending={share.pending} disabled={placed === 0} onShare={share.share} onDownload={share.download} />
    </section>
  );
}
