import { useCallback, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { LaneIcon } from "@/components/LaneIcon";
import { Modal } from "@/features/community/Modal";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { ShareImageButtons } from "@/features/share/ShareImageButtons";
import { useShareImage } from "@/features/share/useShareImage";
import { heroLanes } from "@/lib/heroPositions";
import { heroMatchesQuery } from "@/lib/heroSearch";
import { cn } from "@/lib/utils";
import { formatGeneratedDate, makeFilename, tierLaneGridTemplate, type TierLaneGridImageData } from "@/lib/share-image";
import type { HeroSummary } from "@/types/hero";
import type { CustomTierList } from "./customTierList";
import { laneTierOf, seedLanes, type LaneAssign } from "./tierData";
import { moveLaneHero, removeLaneHero } from "./laneEdit";
import { toShareTiers } from "./laneGrid";
import { useTierLaneGrid } from "./LaneGrid";
import { TierLabel } from "./TierRows";

const DRAG_TYPE = "text/rovlab-lane-hero";
const NEUTRAL = "#64748B";

interface Sel {
  id: string;
  lane: string;
}

// Editable Tier x lane grid (list.lanes). Any hero can be placed in any lane with its own Tier; a move only changes the lanes it names,
// never the traditional board. Everything is local React state: nothing is fetched or written until the page's normal save.
// Desktop: drag a hero onto a cell (or onto a hero to insert before it). Touch/keyboard: tap a hero, then tap "วางที่นี่" in the destination cell.
// A list that was never edited per lane shows the old projection; the first edit copies it into list.lanes (seedLanes), nothing is invented.
export function MyLaneView({
  list,
  setLanes,
  heroes,
  name,
  patch,
  shareExtra,
}: {
  list: CustomTierList;
  setLanes: (fn: (cur: LaneAssign | null) => LaneAssign | null) => void;
  heroes: HeroSummary[];
  name: string;
  patch: string;
  shareExtra?: ReactNode;
}) {
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const { grid, columns, placed } = useTierLaneGrid(list.tiers, byId, list.lanes);
  const [only, setOnly] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [adding, setAdding] = useState<{ lane: string; rowId: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const rowIds = useMemo(() => list.tiers.map((r) => r.id), [list.tiers]);
  const laneName = (code: string) => columns.find((c) => c.code === code)?.label ?? code;
  const tierName = (rowId: string) => list.tiers.find((r) => r.id === rowId)?.label ?? "";
  const seed = useCallback(() => seedLanes(list.tiers, byId, heroLanes, columns.map((c) => c.code)), [list.tiers, byId, columns]);

  // a no-op never seeds or changes list.lanes
  const apply = (fn: (cur: LaneAssign) => LaneAssign) =>
    setLanes((cur) => {
      const base = cur ?? (placed > 0 ? seed() : {});
      const out = fn(base);
      return out === base ? cur : out;
    });

  function move(id: string, from: string | null, lane: string, rowId: string, index?: number) {
    apply((cur) => moveLaneHero(cur, rowIds, id, from, lane, rowId, index));
    setNote(`${byId.get(id)?.nameTh ?? id} อยู่ที่ ${laneName(lane)} · ${tierName(rowId)}`);
    setSel(null);
  }

  function dropAt(e: DragEvent, lane: string, rowId: string, index?: number) {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    try {
      const d = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as { id?: unknown; lane?: unknown };
      if (typeof d.id === "string" && typeof d.lane === "string") move(d.id, d.lane, lane, rowId, index);
    } catch {
      return; // not one of our drags
    }
  }

  const shown = only ? columns.filter((c) => c.code === only) : columns;
  const style = { gridTemplateColumns: `3.5rem repeat(${shown.length}, minmax(7.5rem, 1fr))`, minWidth: `${3.5 + shown.length * 7.875}rem` };
  const selHero = sel ? byId.get(sel.id) : undefined;

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
    <section aria-label="จัดอันดับตามเลน" className="min-w-0 space-y-3 rounded-card border border-border bg-bg-surface p-3">
      <h2 className="font-display text-sm font-semibold">จัดอันดับตามเลน</h2>
      <p className="text-xs text-text-faint">
        ฮีโร่ตัวไหนก็ใส่เลนไหนก็ได้ และแต่ละเลนมี Tier ของตัวเอง · บนคอมลากฮีโร่ไปวางในช่อง · บนมือถือแตะฮีโร่ แล้วแตะ “วางที่นี่” ในช่องปลายทาง · การย้ายไม่กระทบเลนอื่นและไม่กระทบ Tier ในตัวจัดอันดับปกติ
      </p>

      <div role="group" aria-label="กรองเลน" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {[{ code: null as string | null, label: "ทุกเลน", icon: undefined as string | undefined }, ...columns].map((c) => {
          const on = c.code === only;
          return (
            <button
              key={c.code ?? "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setOnly(on && c.code !== null ? null : c.code)}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                on ? "border-accent bg-accent/10 font-semibold text-accent" : "border-border text-text-muted hover:text-text"
              )}
            >
              {c.code !== null && <LaneIcon icon={c.icon} label={c.label} />}
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid gap-1.5" style={style}>
          <div className="sticky left-0 z-10 bg-bg-surface" />
          {shown.map((c) => (
            <div key={c.code} className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg px-2 py-1.5 text-xs font-medium">
              <LaneIcon icon={c.icon} label={c.label} />
              <span className="truncate">{c.label}</span>
            </div>
          ))}
          {grid.rows.map((r) => (
            <div key={r.id} className="contents">
              <div className="sticky left-0 z-10 flex bg-bg-surface">
                <TierLabel row={{ label: r.label, color: r.color ?? NEUTRAL }} className="min-h-[2.5rem] w-full" />
              </div>
              {shown.map((c) => {
                const key = `${c.code}:${r.id}`;
                const cell = r.cells[c.code] ?? [];
                const here = sel !== null && cell.some((h) => h.id === sel.id);
                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setOver(key);
                      }
                    }}
                    onDragLeave={() => setOver((o) => (o === key ? null : o))}
                    onDrop={(e) => dropAt(e, c.code, r.id)}
                    className={cn(
                      "flex min-h-[3.5rem] flex-wrap content-start gap-1 rounded-lg border bg-bg p-1.5",
                      over === key ? "border-accent bg-accent/10" : sel && !here ? "border-dashed border-accent/50" : "border-transparent"
                    )}
                  >
                    {cell.map((h, n) => {
                      const on = sel?.id === h.id && sel.lane === c.code;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: h.id, lane: c.code }));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDrop={(e) => dropAt(e, c.code, r.id, n)}
                          onClick={() => setSel(on ? null : { id: h.id, lane: c.code })}
                          aria-pressed={on}
                          aria-label={`${h.nameTh} · ${c.label} · ${r.label}`}
                          title={h.nameTh}
                          className={cn(
                            "h-11 w-11 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            on ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-accent/40"
                          )}
                        >
                          <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} decorative className="h-full w-full rounded-lg text-base" />
                        </button>
                      );
                    })}
                    {over === key && <span aria-hidden="true" className="self-center text-[10px] font-medium text-accent">วางที่ {c.label} · {r.label}</span>}
                    {sel && selHero && !here ? (
                      <button
                        type="button"
                        onClick={() => move(sel.id, sel.lane, c.code, r.id)}
                        aria-label={`วาง ${selHero.nameTh} ที่ ${c.label} · ${r.label}`}
                        className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-dashed border-accent px-2 text-xs text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        วางที่นี่
                      </button>
                    ) : (
                      !sel && (
                        <button
                          type="button"
                          onClick={() => setAdding({ lane: c.code, rowId: r.id })}
                          aria-label={`เพิ่มฮีโร่ใน ${c.label} · ${r.label}`}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-border text-text-faint hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p role="status" aria-live="polite" className="min-h-4 text-xs text-text-muted">
        {note}
      </p>

      {sel && selHero && (
        <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-2 rounded-card border border-accent/50 bg-bg-surface p-3 shadow-card md:bottom-4">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {selHero.nameTh} · {laneName(sel.lane)} · {tierName(laneTierOf(list.lanes ?? seed(), sel.lane, sel.id) ?? "")} — แตะ “วางที่นี่” ในช่องที่ต้องการ
          </p>
          <button
            type="button"
            onClick={() => {
              apply((cur) => removeLaneHero(cur, sel.lane, sel.id));
              setNote(`เอา ${selHero.nameTh} ออกจากเลน ${laneName(sel.lane)} แล้ว`);
              setSel(null);
            }}
            className="min-h-10 rounded-lg border border-border px-3 text-sm text-red-400 hover:bg-bg-raised"
          >
            เอาออกจากเลนนี้
          </button>
          <button type="button" aria-label="ยกเลิกการเลือก" onClick={() => setSel(null)} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <ShareImageButtons busy={share.busy} pending={share.pending} disabled={placed === 0 && !list.lanes} onShare={share.share} onDownload={share.download} extra={shareExtra} />

      {adding && (
        <AddHeroModal
          heroes={heroes}
          tiers={list.tiers}
          lanes={list.lanes ?? (placed > 0 ? seed() : null)}
          laneCode={adding.lane}
          laneLabel={laneName(adding.lane)}
          startRow={adding.rowId}
          onPick={(id, rowId) => move(id, null, adding.lane, rowId)}
          onClose={() => setAdding(null)}
        />
      )}
    </section>
  );
}

function AddHeroModal({
  heroes,
  tiers,
  lanes,
  laneCode,
  laneLabel,
  startRow,
  onPick,
  onClose,
}: {
  heroes: HeroSummary[];
  tiers: CustomTierList["tiers"];
  lanes: LaneAssign | null;
  laneCode: string;
  laneLabel: string;
  startRow: string;
  onPick: (heroId: string, rowId: string) => void;
  onClose: () => void;
}) {
  const [rowId, setRowId] = useState(startRow);
  const [query, setQuery] = useState("");
  const filters = useHeroFilters("custom"); // same persisted Role/Lane filter as the board's hero pool
  const shown = useMemo(() => heroes.filter((h) => filters.match(h) && heroMatchesQuery(h, query)), [heroes, filters.match, query]);
  const labelOf = (id: string | null) => tiers.find((r) => r.id === id)?.label;
  return (
    <Modal title={`เพิ่มฮีโร่ในเลน ${laneLabel}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-text-faint">
            ใส่ใน Tier
            <select value={rowId} onChange={(e) => setRowId(e.target.value)} className="mt-1 block min-h-10 rounded-lg border border-border bg-bg-surface px-2 text-sm text-text">
              {tiers.map((r) => (
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
        <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
        <div className="grid max-h-[50vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
          {shown.map((h) => {
            const cur = labelOf(laneTierOf(lanes, laneCode, h.id));
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onPick(h.id, rowId)}
                aria-label={cur ? `${h.nameTh} (อยู่ ${cur} ในเลนนี้) ย้ายไป ${labelOf(rowId)}` : `${h.nameTh} ใส่ ${labelOf(rowId)}`}
                className="relative flex min-h-12 flex-col items-center gap-0.5 rounded-lg p-1 hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} decorative className="h-10 w-10 rounded-lg text-base" />
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
