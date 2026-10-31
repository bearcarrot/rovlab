import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HeroIcon } from "@/components/HeroIcon";
import { LaneIcon } from "@/components/LaneIcon";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { LANE_OPTIONS, useFilterIcons } from "@/features/heroes/HeroFilters";
import { heroLanes } from "@/lib/heroPositions";
import { cn } from "@/lib/utils";
import type { HeroDifficulty, HeroSummary } from "@/types/hero";
import type { LaneAssign } from "./tierData";
import { OTHER_LANE, buildAssignedLaneGrid, buildLaneGrid, laneCodesWith, orderLanes, type GridRowIn, type LaneGrid as LaneGridData } from "./laneGrid";
import { emptyTierData, type TierData } from "./tierData";
import { TierLabel } from "./TierRows";

// Official Tier names -> the same colors as the official badges (tierData's default rows). Unknown names get a neutral color.
const OFFICIAL_TIER_COLOR = new Map(emptyTierData().map((r) => [r.label, r.color]));
const NEUTRAL_TIER_COLOR = "#64748B";

// ระดับความยากของฮีโร่ → สีกรอบบางๆ (เขียว/เหลือง/แดง) ใช้ class แบบ static เพื่อให้ Tailwind สแกนเจอ
const DIFFICULTY_LOOK: Record<HeroDifficulty, { border: string; dot: string; label: string }> = {
  easy: { border: "border border-win", dot: "bg-win", label: "ง่าย" },
  medium: { border: "border border-[#eab308]", dot: "bg-[#eab308]", label: "ปานกลาง" },
  hard: { border: "border border-loss", dot: "bg-loss", label: "ยาก" },
};

export interface LaneColumn {
  code: string;
  label: string;
  icon?: string;
}

/** Lane columns in hero_lanes order with DB labels/icons (fallback labels/order until they load). Uses the cached getFilterIcons(): no new request. */
export function useLaneColumns(only?: string | null, extra?: LaneAssign | null): LaneColumn[] {
  const icons = useFilterIcons();
  return useMemo(() => {
    const codes = only ? [only] : laneCodesWith(orderLanes(icons.laneOrder), extra);
    return codes.map((code) => ({
      code,
      label: icons.laneLabels[code] ?? LANE_OPTIONS.find((o) => o.value === code)?.label ?? code,
      icon: icons.lanes[code],
    }));
  }, [icons, only, extra]);
}

/** Rows of a custom tier list / Community snapshot. Unknown hero ids are skipped (as in TierRows); empty rows are kept. */
export function useTierLaneGrid(data: TierData, byId: Map<string, HeroSummary>, assigned: LaneAssign | null = null) {
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
  const columns = useLaneColumns(null, assigned);
  // stored per-lane placements are the source of truth; a list without them (legacy / never edited per lane) keeps the old projection
  const grid = useMemo(
    () =>
      assigned
        ? buildAssignedLaneGrid(rows, assigned, byId, columns.map((c) => c.code))
        : buildLaneGrid(rows, { lanes: columns.map((c) => c.code), laneOf: heroLanes }),
    [rows, assigned, byId, columns]
  );
  const placed = assigned
    ? grid.rows.reduce((n, r) => n + Object.values(r.cells).reduce((m, c) => m + c.length, 0), 0)
    : rows.reduce((n, r) => n + r.heroes.length, 0);
  return { grid, columns, placed };
}

/**
 * Read-only Tier rows x lane columns. Scrolls sideways on phones; the Tier label column stays visible.
 * Lane choice normally comes from the page's own lane filter (the caller passes only that column), so there is no second lane
 * filter here. `laneChips` adds a view-only lane picker for hosts that have no filter of their own (the Community preview modal).
 * Either way this component never edits placements, and there is a single grid, so no extra hero images are rendered.
 * `showDifficulty` draws a thin green/yellow/red border by hero difficulty (+ a small legend); off by default so other hosts are unchanged.
 */
export function LaneGrid({
  grid,
  columns,
  balanceBadge = false,
  laneChips = false,
  showDifficulty = false,
}: {
  grid: LaneGridData<HeroSummary>;
  columns: LaneColumn[];
  balanceBadge?: boolean;
  laneChips?: boolean;
  showDifficulty?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const meta = new Map(columns.map((c) => [c.code, c]));
  const all: LaneColumn[] = grid.lanes.map((code) => meta.get(code) ?? { code, label: code });
  if (grid.hasUnassigned) all.push({ code: OTHER_LANE, label: "อื่นๆ" });
  // a stale pick (that lane is no longer a column) falls back to all lanes
  const cols = laneChips && picked ? all.filter((c) => c.code === picked) : all;
  const shown = cols.length > 0 ? cols : all;
  const style = {
    gridTemplateColumns: `3.5rem repeat(${shown.length}, minmax(7.5rem, 1fr))`,
    minWidth: `${3.5 + shown.length * 7.875}rem`,
  };
  return (
    <div className="space-y-2">
      {laneChips && all.length > 1 && (
        <div role="group" aria-label="เลือกเลนที่จะดู (ดูอย่างเดียว)" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[{ code: null as string | null, label: "ทุกเลน", icon: undefined as string | undefined }, ...all].map((c) => {
            const active = (c.code ?? null) === (shown === all ? null : picked);
            return (
              <button
                key={c.code ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setPicked(active && c.code !== null ? null : c.code)}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active ? "border-accent bg-accent/10 text-accent" : "border-border text-text-muted hover:text-text"
                )}
              >
                {c.code !== null && c.code !== OTHER_LANE && <LaneIcon icon={c.icon} label={c.label} />}
                {c.label}
              </button>
            );
          })}
        </div>
      )}
      {showDifficulty && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint" aria-label="สีกรอบ = ความยากของฮีโร่">
          <span>กรอบสี:</span>
          {(["easy", "medium", "hard"] as const).map((d) => (
            <span key={d} className="flex items-center gap-1">
              <span className={cn("h-2.5 w-2.5 rounded-sm", DIFFICULTY_LOOK[d].dot)} aria-hidden />
              {DIFFICULTY_LOOK[d].label}
            </span>
          ))}
        </div>
      )}
      {/* isolate = z-index ภายในตาราง (ป้ายบัฟ/เนิฟ z-10, ป้าย Tier ที่ตรึงซ้าย z-20) ไม่รั่วไปชนส่วนอื่นของหน้า; ป้าย Tier ต้องอยู่เหนือป้ายบัฟ/เนิฟของฮีโร่ที่เลื่อนมาอยู่ใต้ */}
      <div className="isolate overflow-x-auto pb-1">
        <div className="grid gap-1.5" style={style}>
          <div className="sticky left-0 z-20 bg-bg" />
          {shown.map((c) => (
            <div key={c.code} className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-surface px-2 py-1.5 text-xs font-medium">
              {c.code !== OTHER_LANE && <LaneIcon icon={c.icon} label={c.label} />}
              <span className="truncate">{c.label}</span>
            </div>
          ))}
          {grid.rows.map((r) => (
            <Fragment key={r.id}>
              {/* the grid cell is as tall as the row; the flex child stretches to it (no fixed height, so wrapped rows never clip) */}
              <div className="sticky left-0 z-20 flex bg-bg">
                <TierLabel
                  row={{ label: r.label, color: r.color ?? OFFICIAL_TIER_COLOR.get(r.label) ?? NEUTRAL_TIER_COLOR }}
                  className="min-h-[2.5rem] w-full"
                />
              </div>
              {shown.map((c) => {
                const heroes = c.code === OTHER_LANE ? r.unassigned : (r.cells[c.code] ?? []);
                return (
                  <div key={c.code} className="flex min-h-[3.5rem] flex-wrap content-start gap-1 rounded-lg bg-bg-surface p-1.5">
                    {heroes.map((h) => {
                      const diff = showDifficulty ? DIFFICULTY_LOOK[h.difficulty] : undefined;
                      const label = diff ? `${h.nameTh} · ${diff.label}` : h.nameTh;
                      return (
                        <Link
                          key={h.id}
                          to={`/heroes/${h.slug}`}
                          aria-label={label}
                          title={label}
                          className={cn(
                            "relative h-10 w-10 shrink-0 rounded-lg bg-bg-raised hover:ring-2 hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            diff?.border
                          )}
                        >
                          <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} className="h-full w-full rounded-lg text-base" />
                          {balanceBadge && <HeroBalanceBadge heroId={h.id} size="xs" inside />}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Community snapshot / any saved list: the lane grid (with its own view-only lane picker), or the same empty message TierRows used. */
export function TierLaneView({ data, byId, lanes = null }: { data: TierData; byId: Map<string, HeroSummary>; lanes?: LaneAssign | null }) {
  const { grid, columns, placed } = useTierLaneGrid(data, byId, lanes);
  if (placed === 0) return <p className="text-xs text-text-faint">ยังไม่มีฮีโร่ใน Tier List นี้</p>;
  return <LaneGrid grid={grid} columns={columns} laneChips />;
}
