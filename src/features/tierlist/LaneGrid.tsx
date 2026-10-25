import { Fragment, useMemo } from "react";
import { Link } from "react-router-dom";
import { HeroIcon } from "@/components/HeroIcon";
import { LaneIcon } from "@/components/LaneIcon";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { LANE_OPTIONS, useFilterIcons } from "@/features/heroes/HeroFilters";
import { heroLanes } from "@/lib/heroPositions";
import type { HeroSummary } from "@/types/hero";
import { OTHER_LANE, buildLaneGrid, orderLanes, type GridRowIn, type LaneGrid as LaneGridData } from "./laneGrid";
import { emptyTierData, type TierData } from "./tierData";
import { TierLabel } from "./TierRows";

// Official Tier names -> the same colors as the official badges (tierData's default rows). Unknown names get a neutral color.
const OFFICIAL_TIER_COLOR = new Map(emptyTierData().map((r) => [r.label, r.color]));
const NEUTRAL_TIER_COLOR = "#64748B";

export interface LaneColumn {
  code: string;
  label: string;
  icon?: string;
}

/** Lane columns in hero_lanes order with DB labels/icons (fallback labels/order until they load). Uses the cached getFilterIcons(): no new request. */
export function useLaneColumns(only?: string | null): LaneColumn[] {
  const icons = useFilterIcons();
  return useMemo(() => {
    const codes = only ? [only] : orderLanes(icons.laneOrder);
    return codes.map((code) => ({
      code,
      label: icons.laneLabels[code] ?? LANE_OPTIONS.find((o) => o.value === code)?.label ?? code,
      icon: icons.lanes[code],
    }));
  }, [icons, only]);
}

/** `rows` must be memoized by the caller. `forceLane` = active lane filter (single column). */
export function useLaneGrid(rows: GridRowIn<HeroSummary>[], forceLane: string | null = null) {
  const columns = useLaneColumns(forceLane);
  const grid = useMemo(
    () => buildLaneGrid(rows, { lanes: columns.map((c) => c.code), laneOf: heroLanes, forceLane }),
    [rows, columns, forceLane]
  );
  return { grid, columns };
}

/** Rows of a custom tier list / Community snapshot. Unknown hero ids are skipped (as in TierRows); empty rows are kept. */
export function useTierLaneGrid(data: TierData, byId: Map<string, HeroSummary>) {
  const rows = useMemo<GridRowIn<HeroSummary>[]>(
    () =>
      data.map((r) => ({
        id: r.id,
        label: r.label,
        color: r.color,
        heroes: r.heroes.flatMap((id) => {
          const h = byId.get(id);
          return h ? [h] : [];
        }),
      })),
    [data, byId]
  );
  const { grid, columns } = useLaneGrid(rows);
  const placed = rows.reduce((n, r) => n + r.heroes.length, 0);
  return { grid, columns, placed };
}

/** Read-only Tier rows x lane columns. Scrolls sideways on phones; the Tier label column stays visible. */
export function LaneGrid({ grid, columns, balanceBadge = false }: { grid: LaneGridData<HeroSummary>; columns: LaneColumn[]; balanceBadge?: boolean }) {
  const meta = new Map(columns.map((c) => [c.code, c]));
  const cols: LaneColumn[] = grid.lanes.map((code) => meta.get(code) ?? { code, label: code });
  if (grid.hasUnassigned) cols.push({ code: OTHER_LANE, label: "อื่นๆ" });
  const style = {
    gridTemplateColumns: `3.5rem repeat(${cols.length}, minmax(7.5rem, 1fr))`,
    minWidth: `${3.5 + cols.length * 7.875}rem`,
  };
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid gap-1.5" style={style}>
        <div className="sticky left-0 z-10 bg-bg" />
        {cols.map((c) => (
          <div key={c.code} className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-surface px-2 py-1.5 text-xs font-medium">
            {c.code !== OTHER_LANE && <LaneIcon icon={c.icon} label={c.label} />}
            <span className="truncate">{c.label}</span>
          </div>
        ))}
        {grid.rows.map((r) => (
          <Fragment key={r.id}>
            {/* the grid cell is as tall as the row; the flex child stretches to it (no fixed height, so wrapped rows never clip) */}
            <div className="sticky left-0 z-10 flex bg-bg">
              <TierLabel
                row={{ label: r.label, color: r.color ?? OFFICIAL_TIER_COLOR.get(r.label) ?? NEUTRAL_TIER_COLOR }}
                className="min-h-[2.5rem] w-full"
              />
            </div>
            {cols.map((c) => {
              const heroes = c.code === OTHER_LANE ? r.unassigned : (r.cells[c.code] ?? []);
              return (
                <div key={c.code} className="flex min-h-[3.5rem] flex-wrap content-start gap-1 rounded-lg bg-bg-surface p-1.5">
                  {heroes.map((h) => (
                    <Link
                      key={h.id}
                      to={`/heroes/${h.slug}`}
                      aria-label={h.nameTh}
                      title={h.nameTh}
                      className="relative h-10 w-10 shrink-0 rounded-lg bg-bg-raised hover:ring-2 hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} className="h-full w-full rounded-lg text-base" />
                      {balanceBadge && <HeroBalanceBadge heroId={h.id} size="md" inside />}
                    </Link>
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Community snapshot / any saved list: the lane grid, or the same empty message TierRows used. */
export function TierLaneView({ data, byId }: { data: TierData; byId: Map<string, HeroSummary> }) {
  const { grid, columns, placed } = useTierLaneGrid(data, byId);
  if (placed === 0) return <p className="text-xs text-text-faint">ยังไม่มีฮีโร่ใน Tier List นี้</p>;
  return <LaneGrid grid={grid} columns={columns} />;
}
