// Pure moves for the editable lane grid. Import-free on purpose (type-only import) so node:test can run it.
// A move touches only the destination lane and, for a cross-lane move, the source lane. Other lanes are never copied or changed.
import type { LaneAssign } from "./tierData";

// shortcut: literals mirror MAX_LANES / MAX_LANE_PLACEMENTS in tierData.ts; parseLanes still enforces them on save. Dedupe if tierData gets a node-safe import path.
const MAX_LANES = 12;
const MAX_PLACEMENTS = 600;

type Cells = Record<string, string[]>;

const without = (cells: Cells, id: string): Cells => {
  const out: Cells = {};
  for (const [row, heroes] of Object.entries(cells)) {
    const kept = heroes.filter((x) => x !== id);
    if (kept.length > 0) out[row] = kept;
  }
  return out;
};

const tierIn = (cells: Cells | undefined, id: string): string | null => {
  for (const [row, heroes] of Object.entries(cells ?? {})) if (heroes.includes(id)) return row;
  return null;
};

const total = (l: LaneAssign) => Object.values(l).reduce((n, c) => n + Object.values(c).reduce((m, h) => m + h.length, 0), 0);

/**
 * Put `id` in `rowId` of lane `to` (at `index` in that cell, or at the end). `from` = lane it comes from (null = adding from the picker):
 * a different `from` lane loses the hero, so it is a move. Returns the same object when nothing changes or the target row is unknown.
 */
export function moveLaneHero(
  l: LaneAssign | null | undefined,
  rowIds: readonly string[],
  id: string,
  from: string | null,
  to: string,
  rowId: string,
  index?: number
): LaneAssign {
  const base = l ?? {};
  if (!rowIds.includes(rowId)) return base;
  const cur = tierIn(base[to], id);
  const samePlace = cur === rowId && (from === null || from === to);
  if (samePlace && index === undefined) return base;
  if (cur === null && from === null && total(base) >= MAX_PLACEMENTS) return base;
  if (cur === null && !(to in base) && Object.keys(base).length >= MAX_LANES) return base;

  let at = index;
  if (at !== undefined && cur === rowId) {
    const p = (base[to]?.[rowId] ?? []).indexOf(id);
    if (p !== -1 && p < at) at -= 1; // the hero leaves its old slot first
  }
  const target = without(base[to] ?? {}, id);
  const row = [...(target[rowId] ?? [])];
  row.splice(at === undefined ? row.length : Math.max(0, Math.min(at, row.length)), 0, id);
  target[rowId] = row;

  const next: LaneAssign = { ...base, [to]: target };
  if (from && from !== to) {
    const rest = without(base[from] ?? {}, id);
    if (Object.keys(rest).length > 0) next[from] = rest;
    else delete next[from];
  }
  return next;
}

/** Remove a hero from ONE lane; its placements in other lanes stay. */
export function removeLaneHero(l: LaneAssign | null | undefined, lane: string, id: string): LaneAssign {
  const base = l ?? {};
  if (tierIn(base[lane], id) === null) return base;
  const rest = without(base[lane] ?? {}, id);
  const next = { ...base };
  if (Object.keys(rest).length > 0) next[lane] = rest;
  else delete next[lane];
  return next;
}
