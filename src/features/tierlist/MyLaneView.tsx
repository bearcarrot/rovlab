import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { LaneIcon } from "@/components/LaneIcon";
import { Modal } from "@/features/community/Modal";
import { ShareImageButtons } from "@/features/share/ShareImageButtons";
import { useShareImage } from "@/features/share/useShareImage";
import { heroLanes } from "@/lib/heroPositions";
import { heroMatchesQuery } from "@/lib/heroSearch";
import { cn } from "@/lib/utils";
import { formatGeneratedDate, makeFilename, tierLaneGridTemplate, type TierLaneGridImageData } from "@/lib/share-image";
import type { HeroSummary } from "@/types/hero";
import type { CustomTierList } from "./customTierList";
import { laneRows, laneTierOf, seedLanes, setLaneTier, type LaneAssign } from "./tierData";
import { toShareTiers } from "./laneGrid";
import { LaneGrid, useLaneColumns, useTierLaneGrid } from "./LaneGrid";
import { TierLabel } from "./TierRows";

// Lane view of the list being edited. Placements are stored per lane (list.lanes): any hero can be put in any lane with its own
// Tier there, and changing one lane never touches another lane or the traditional board. A list that was never edited per lane
// shows the old projection of the board; the first lane edit copies that projection into list.lanes (seedLanes), nothing is invented.
export function MyLaneView({
  list,
  setLanes,
  heroes,
  name,
  patch,
}: {
  list: CustomTierList;
  setLanes: (fn: (cur: LaneAssign | null) => LaneAssign | null) => void;
  heroes: HeroSummary[];
  name: string;
  patch: string;
}) {
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const { grid, columns, placed } = useTierLaneGrid(list.tiers, byId, list.lanes);
  const [lane, setLane] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const std = useLaneColumns(null, list.lanes);
  const active = std.find((c) => c.code === lane) ?? std[0];
  // what the editor shows for the lane: stored placements, or the legacy projection until the first edit
  const seed = useCallback(() => seedLanes(list.tiers, byId, heroLanes, std.map((c) => c.code)), [list.tiers, byId, std]);
  const effective = list.lanes ?? (placed > 0 ? seed() : null);
  const rows = laneRows(effective, list.tiers, active?.code ?? "");
  const edit = (heroId: string, rowId: string | null) => {
    if (!active) return;
    const code = active.code;
    const tiers = list.tiers;
    setLanes((cur) => setLaneTier(cur ?? seed(), tiers, code, heroId, rowId));
  };

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
    <section aria-label="มุมมองตามเลน" className="space-y-3 rounded-card border border-border bg-bg-surface p-3">
      <h2 className="font-display text-sm font-semibold">จัดอันดับตามเลน</h2>
      <p className="text-xs text-text-faint">
        ฮีโร่ตัวไหนก็ใส่เลนไหนก็ได้ และแต่ละเลนมี Tier ของตัวเอง การแก้ในเลนหนึ่งไม่กระทบเลนอื่นและไม่กระทบตัวจัดอันดับด้านล่าง
      </p>

      <div role="group" aria-label="เลือกเลนที่จะแก้" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {std.map((c) => {
          const on = c.code === active?.code;
          return (
            <button
              key={c.code}
              type="button"
              aria-pressed={on}
              onClick={() => setLane(c.code)}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                on ? "border-accent bg-accent/10 text-accent" : "border-border text-text-muted hover:text-text"
              )}
            >
              <LaneIcon icon={c.icon} label={c.label} />
              {c.label}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="space-y-2" aria-label={`กำลังแก้เลน ${active.label}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">กำลังแก้: {active.label}</p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              เพิ่มฮีโร่
            </button>
          </div>
          {list.tiers.map((t, i) => (
            <div key={t.id} className="flex gap-2">
              <TierLabel row={t} className="min-h-[2.5rem] w-14 shrink-0 self-stretch" />
              <div className="flex min-h-[3.5rem] flex-1 flex-wrap content-start gap-1.5 rounded-lg bg-bg-raised p-1.5">
                {rows[i].heroes.flatMap((id) => {
                  const h = byId.get(id);
                  return h
                    ? [
                        <div key={id} className="flex w-24 flex-col items-stretch gap-1">
                          <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} className="mx-auto h-10 w-10 rounded-lg text-base" />
                          <select
                            aria-label={`Tier ของ ${h.nameTh} ในเลน ${active.label}`}
                            value={t.id}
                            onChange={(e) => edit(id, e.target.value === "" ? null : e.target.value)}
                            className="min-h-10 rounded-md border border-border bg-bg-surface px-1 text-xs"
                          >
                            {list.tiers.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                            <option value="">เอาออกจากเลนนี้</option>
                          </select>
                        </div>,
                      ]
                    : [];
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {placed === 0 && !list.lanes ? (
        <p className="text-xs text-text-faint">ยังไม่มีฮีโร่ในเลน กด “เพิ่มฮีโร่” เพื่อเริ่ม</p>
      ) : (
        <details className="group">
          <summary className="cursor-pointer text-xs text-text-muted">ดูทุกเลนพร้อมกัน (ดูอย่างเดียว)</summary>
          <div className="pt-2">
            <LaneGrid grid={grid} columns={columns} />
          </div>
        </details>
      )}
      <ShareImageButtons busy={share.busy} pending={share.pending} disabled={placed === 0} onShare={share.share} onDownload={share.download} />

      {adding && active && (
        <AddHeroModal
          laneLabel={active.label}
          heroes={heroes}
          list={list}
          effective={effective}
          lane={active.code}
          onPick={edit}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}

function AddHeroModal({
  laneLabel,
  heroes,
  list,
  effective,
  lane,
  onPick,
  onClose,
}: {
  laneLabel: string;
  heroes: HeroSummary[];
  list: CustomTierList;
  effective: LaneAssign | null;
  lane: string;
  onPick: (heroId: string, rowId: string | null) => void;
  onClose: () => void;
}) {
  const [rowId, setRowId] = useState(list.tiers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => heroes.filter((h) => heroMatchesQuery(h, query)), [heroes, query]);
  const labelOf = (id: string | null) => list.tiers.find((r) => r.id === id)?.label;
  return (
    <Modal title={`เพิ่มฮีโร่ในเลน ${laneLabel}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-text-faint">
            ใส่ใน Tier
            <select value={rowId} onChange={(e) => setRowId(e.target.value)} className="mt-1 block min-h-10 rounded-lg border border-border bg-bg-surface px-2 text-sm text-text">
              {list.tiers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[10rem] flex-1 text-xs text-text-faint">
            ค้นหาฮีโร่
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-bg-surface px-2 text-sm text-text" />
          </label>
        </div>
        <div className="grid max-h-[50vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {shown.map((h) => {
            const cur = labelOf(laneTierOf(effective, lane, h.id));
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onPick(h.id, rowId)}
                aria-label={cur ? `${h.nameTh} (อยู่ ${cur} ในเลนนี้) ย้ายไป ${labelOf(rowId)}` : `${h.nameTh} ใส่ ${labelOf(rowId)}`}
                className="relative flex min-h-12 flex-col items-center gap-0.5 rounded-lg p-1 hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} className="h-10 w-10 rounded-lg text-base" />
                <span className="max-w-full truncate text-[10px] text-text-muted">{h.nameTh}</span>
                {cur && <span className="absolute right-0 top-0 rounded bg-accent px-1 text-[10px] font-semibold text-accent-fg">{cur}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm">
          <X className="h-4 w-4" aria-hidden="true" />
          เสร็จ
        </button>
      </div>
    </Modal>
  );
}
