// Pure Tier x lane grouping shared by the web grid and the share PNG, so both always show the same placements.
// Dependency-free so it can be unit tested. Callers pass heroLanes() (lib/heroPositions) as `laneOf`, which keeps the
// legacy lane/lanes fallback in one place.
//
// A hero is placed in every lane it has, inside the row (Tier) it is listed in. Rows keep their order, label and color.
// A hero listed in several rows (allowDuplicates) shows in each of them; a hero is never repeated inside one row x lane cell.
// A hero none of whose lanes is a visible column is kept in `unassigned` (shown as an extra column) instead of being dropped.

import type { LaneAssign } from "./tierData";

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

/** Lane codes to show as columns: the standard ones (in `base` order) plus any other lane the user placed heroes in. */
export function laneCodesWith(base: readonly string[], lanes: LaneAssign | null | undefined): string[] {
  return [...base, ...Object.keys(lanes ?? {}).filter((l) => !base.includes(l)).sort()];
}

/**
 * Grid of a custom list / Community snapshot that has stored per-lane placements: the stored `lanes` are the only source
 * (no role/lane metadata is used). Rows keep order, label and color; empty rows are kept; unknown hero ids are skipped.
 */
export function buildAssignedLaneGrid<H extends { id: string }>(
  rows: readonly { id: string; label: string; color?: string }[],
  lanes: LaneAssign,
  byId: ReadonlyMap<string, H>,
  codes: readonly string[]
): LaneGrid<H> {
  return {
    lanes: [...codes],
    hasUnassigned: false,
    rows: rows.map((r) => ({
      id: r.id,
      label: r.label,
      color: r.color,
      cells: Object.fromEntries(codes.map((l) => [l, (lanes[l]?.[r.id] ?? []).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))])),
      unassigned: [],
    })),
  };
}

/**
 * Official grid with lane-specific rankings (no lane filter). `lists` = lane code (or `allKey`) -> hero id -> Tier, as
 * returned by getCuratedTierLists(). A lane that has its own list is authoritative for that column: a hero is in the
 * Tier that list gives it, and only if it is in the list. A lane without its own list falls back to the all-lanes list
 * for heroes tagged with that lane (what the page showed before). Nothing is inferred: a hero absent from a lane's list
 * is not shown in that lane. Empty Tier rows are dropped; cells are A-Z by name.
 */
export function buildCuratedLaneGrid<H extends { id: string; name: string }>(
  heroes: readonly H[],
  lists: ReadonlyMap<string, ReadonlyMap<string, string>>,
  opts: { lanes: readonly string[]; laneOf: (h: H) => readonly string[]; tiers: readonly string[]; allKey: string; tier?: string | null }
): LaneGrid<H> {
  const lanes = [...opts.lanes];
  const all = lists.get(opts.allKey);
  const rows = new Map<string, GridRow<H>>();
  for (const t of opts.tiers) {
    if (opts.tier && t !== opts.tier) continue;
    rows.set(t, { id: t, label: t, cells: Object.fromEntries(lanes.map((l) => [l, [] as H[]])), unassigned: [] });
  }
  for (const h of heroes) {
    const mine = opts.laneOf(h);
    for (const l of lanes) {
      const own = lists.get(l);
      const t = own ? own.get(h.id) : mine.includes(l) ? all?.get(h.id) : undefined;
      if (t !== undefined) rows.get(t)?.cells[l].push(h);
    }
    const t = all?.get(h.id);
    if (t !== undefined && !mine.some((l) => lanes.includes(l))) rows.get(t)?.unassigned.push(h);
  }
  const byName = (a: H, b: H) => a.name.localeCompare(b.name, "en");
  const out = [...rows.values()].filter((r) => r.unassigned.length > 0 || lanes.some((l) => r.cells[l].length > 0));
  for (const r of out) {
    for (const l of lanes) r.cells[l].sort(byName);
    r.unassigned.sort(byName);
  }
  return { lanes, rows: out, hasUnassigned: out.some((r) => r.unassigned.length > 0) };
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
