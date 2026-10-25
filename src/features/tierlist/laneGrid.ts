// Pure Tier x lane grouping shared by the web grid and the share PNG, so both always show the same placements.
// Dependency-free so it can be unit tested. Callers pass heroLanes() (lib/heroPositions) as `laneOf`, which keeps the
// legacy lane/lanes fallback in one place.
//
// A hero is placed in every lane it has, inside the row (Tier) it is listed in. Rows keep their order, label and color.
// A hero listed in several rows (allowDuplicates) shows in each of them; a hero is never repeated inside one row x lane cell.
// A hero none of whose lanes is a visible column is kept in `unassigned` (shown as an extra column) instead of being dropped.

export const DEFAULT_LANES = ["slayer", "jungle", "mid", "abyssal", "roaming"] as const;
export const OTHER_LANE = "other";

/** Default lane codes sorted by hero_lanes.sort_order (`order`); codes missing from it keep the default order, after the others. */
export function orderLanes(order: readonly string[] = []): string[] {
  const pos = (c: string) => {
    const i = order.indexOf(c);
    return i === -1 ? order.length : i;
  };
  return [...DEFAULT_LANES].sort((a, b) => pos(a) - pos(b));
}

export interface GridRowIn<H> {
  id: string;
  label: string;
  /** #RRGGBB of a custom row; undefined = official Tier (badge colors come from the Tier name) */
  color?: string;
  heroes: H[];
}

export interface GridRow<H> {
  id: string;
  label: string;
  color?: string;
  cells: Record<string, H[]>;
  unassigned: H[];
}

export interface LaneGrid<H> {
  lanes: string[];
  rows: GridRow<H>[];
  hasUnassigned: boolean;
}

export function buildLaneGrid<H extends { id: string }>(
  rows: GridRowIn<H>[],
  opts: {
    lanes: readonly string[];
    laneOf: (h: H) => readonly string[];
    /** A lane filter is active: only that column, and every hero listed in the (already lane-specific) rows goes into it. */
    forceLane?: string | null;
  }
): LaneGrid<H> {
  const lanes = opts.forceLane ? [opts.forceLane] : [...opts.lanes];
  const has = (cells: Record<string, H[]>, l: string) => Object.prototype.hasOwnProperty.call(cells, l);
  let hasUnassigned = false;
  const out = rows.map((r) => {
    const cells: Record<string, H[]> = {};
    for (const l of lanes) cells[l] = [];
    const unassigned: H[] = [];
    for (const h of r.heroes) {
      const mine = opts.forceLane ? lanes : opts.laneOf(h).filter((l) => has(cells, l));
      if (mine.length === 0) {
        if (!unassigned.some((x) => x.id === h.id)) unassigned.push(h);
        continue;
      }
      for (const l of new Set(mine)) if (!cells[l].some((x) => x.id === h.id)) cells[l].push(h);
    }
    if (unassigned.length > 0) hasUnassigned = true;
    return { id: r.id, label: r.label, color: r.color, cells, unassigned };
  });
  return { lanes, rows: out, hasUnassigned };
}

export interface ShareCellHero {
  id: string;
  name: string;
  icon: string;
}

/** The grid in the shape the share-image template draws (cells follow `grid.lanes` order). */
export function toShareTiers<H extends ShareCellHero>(grid: LaneGrid<H>) {
  const pick = (h: H): ShareCellHero => ({ id: h.id, name: h.name, icon: h.icon });
  return grid.rows.map((r) => ({
    tier: r.label,
    color: r.color,
    cells: grid.lanes.map((l) => r.cells[l].map(pick)),
    unassigned: r.unassigned.map(pick),
  }));
}
