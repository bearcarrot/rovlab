// Pure helpers for the shape of a tier list (editor, My Tier Lists, Community snapshots, share images).
// Kept dependency-free so it can be unit tested.
//
// Rows are ordered and user-defined: { id, label, color, heroes[] }. Hero ids only; icons/names are resolved
// from the hero database when rendering.
// Stored in the DB (jsonb) as { "v": 2, "rows": [...] } (one board) or, for multi-lane lists,
// { "v": 3, "lanes": [ { "id": "jungle", "rows": [...] }, ... ] } (see "lanes" below).
// The legacy shape { "S+": [...], S, A, B, C } is still read everywhere (old saved lists and Community snapshots
// are never rewritten) and maps to five default rows.

import type { HeroLane } from "@/types/hero";

export const NAME_MAX = 40;
export const TIER_LABEL_MAX = 12;
export const MAX_ROWS = 20;
export const MAX_HEROES = 200; // across one board (same cap as before; with lanes it applies per lane)
const HERO_ID_MAX = 64;
const ROW_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const FALLBACK_COLOR = "#64748B";

export interface TierRow {
  id: string;
  label: string;
  color: string; // #RRGGBB
  heroes: string[];
}
export type TierData = TierRow[];

// Same colors as the official tier badges (tailwind colors.tier / share-image TIER_COLORS).
const DEFAULT_ROWS = [
  { id: "s-plus", label: "S+", color: "#DC2626" },
  { id: "s", label: "S", color: "#F97316" },
  { id: "a", label: "A", color: "#EAB308" },
  { id: "b", label: "B", color: "#22C55E" },
  { id: "c", label: "C", color: "#3B82F6" },
] as const;

/** Colors offered by the editor's row color picker (any #RRGGBB is accepted). */
export const ROW_COLOR_PRESETS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899", "#64748B"];

export const emptyTierData = (): TierData => DEFAULT_ROWS.map((r) => ({ ...r, heroes: [] }));

export const isHexColor = (v: unknown): v is string => typeof v === "string" && COLOR_RE.test(v);
export const cleanLabel = (v: unknown): string => (typeof v === "string" ? v.trim().slice(0, TIER_LABEL_MAX) : "");

function nextRowId(used: Set<string>): string {
  for (let n = 1; ; n++) if (!used.has(`r${n}`)) return `r${n}`;
}

/** Never trust jsonb / localStorage: accepts the v2 shape, a bare rows array, or the legacy fixed-key object. */
export function parseTierData(raw: unknown): TierData {
  if (!raw || typeof raw !== "object") return emptyTierData();
  const seen = new Set<string>();
  const takeHeroes = (list: unknown): string[] => {
    const out: string[] = [];
    if (!Array.isArray(list)) return out;
    for (const id of list) {
      if (typeof id === "string" && id.length > 0 && id.length <= HERO_ID_MAX && !seen.has(id) && seen.size < MAX_HEROES) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  };

  const o = raw as { v?: unknown; rows?: unknown };
  const rowsRaw = Array.isArray(raw) ? raw : o.v === 2 && Array.isArray(o.rows) ? o.rows : null;
  if (rowsRaw === null) {
    // legacy: keep the five default rows, hero order unchanged
    return emptyTierData().map((r) => ({ ...r, heroes: takeHeroes((raw as Record<string, unknown>)[r.label]) }));
  }

  const used = new Set<string>();
  const out: TierRow[] = [];
  for (const item of rowsRaw) {
    if (out.length >= MAX_ROWS) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" && ROW_ID_RE.test(r.id) && !used.has(r.id) ? r.id : nextRowId(used);
    used.add(id);
    out.push({
      id,
      label: cleanLabel(r.label) || "Tier",
      color: isHexColor(r.color) ? r.color.toUpperCase() : FALLBACK_COLOR,
      heroes: takeHeroes(r.heroes),
    });
  }
  return out.length > 0 ? out : emptyTierData();
}

/** The jsonb written to the DB. Normalizes first, so invalid input can never reach the CHECK constraint. */
export const serializeTierData = (rows: TierData): { v: 2; rows: TierData } => ({ v: 2, rows: parseTierData(rows) });

export const tierHeroCount = (d: TierData): number => d.reduce((n, r) => n + r.heroes.length, 0);

/** Signature for unsaved-change detection: row ids, labels, colors, order and hero placement. */
export const tierSig = (d: TierData): string => JSON.stringify(d.map((r) => [r.id, r.label, r.color, r.heroes]));

/** True when the rows differ from the default five (ignoring heroes), e.g. renamed, recolored, added, reordered. */
export const rowsCustomized = (d: TierData): boolean =>
  JSON.stringify(d.map((r) => [r.id, r.label, r.color])) !== JSON.stringify(DEFAULT_ROWS.map((r) => [r.id, r.label, r.color]));

// ---- editing operations (all pure; return the same array when nothing changes) ----

export const findTier = (d: TierData, heroId: string): string | null => d.find((r) => r.heroes.includes(heroId))?.id ?? null;

/** A hero lives in one row only: removed from where it was, then inserted into `toRowId` (null = back to the pool). */
export function moveHero(d: TierData, heroId: string, toRowId: string | null, index?: number): TierData {
  if (toRowId !== null && !d.some((r) => r.id === toRowId)) return d;
  if (toRowId !== null && findTier(d, heroId) === null && tierHeroCount(d) >= MAX_HEROES) return d;
  return d.map((r) => {
    const heroes = r.heroes.filter((x) => x !== heroId);
    if (r.id === toRowId) heroes.splice(index === undefined ? heroes.length : Math.max(0, Math.min(index, heroes.length)), 0, heroId);
    return { ...r, heroes };
  });
}

/** Move left/right inside the same row (buttons instead of dragging: works on touch and keyboard). */
export function shiftHero(d: TierData, heroId: string, dir: -1 | 1): TierData {
  const row = d.find((r) => r.heroes.includes(heroId));
  if (!row) return d;
  const i = row.heroes.indexOf(heroId);
  const j = i + dir;
  if (j < 0 || j >= row.heroes.length) return d;
  const heroes = [...row.heroes];
  [heroes[i], heroes[j]] = [heroes[j], heroes[i]];
  return d.map((r) => (r === row ? { ...r, heroes } : r));
}

export function addRow(d: TierData): TierData {
  if (d.length >= MAX_ROWS) return d;
  const id = nextRowId(new Set(d.map((r) => r.id)));
  return [...d, { id, label: "Tier", color: ROW_COLOR_PRESETS[d.length % ROW_COLOR_PRESETS.length], heroes: [] }];
}

/** Invalid label (empty) or color is ignored. */
export function updateRow(d: TierData, rowId: string, patch: { label?: string; color?: string }): TierData {
  const label = patch.label === undefined ? undefined : cleanLabel(patch.label);
  const color = patch.color !== undefined && isHexColor(patch.color) ? patch.color.toUpperCase() : undefined;
  return d.map((r) => (r.id === rowId ? { ...r, label: label || r.label, color: color ?? r.color } : r));
}

export function moveRow(d: TierData, rowId: string, dir: -1 | 1): TierData {
  const i = d.findIndex((r) => r.id === rowId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.length) return d;
  const next = [...d];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Heroes of a deleted row go back to the unranked pool (they are simply no longer placed). Keeps at least one row. */
export const deleteRow = (d: TierData, rowId: string): TierData => (d.length <= 1 ? d : d.filter((r) => r.id !== rowId));

// ---- lanes (one tier list = several independent boards) ----
// A lane id is a hero lane code (same codes as hero_lanes / HeroLane) or "all" (the single general board every
// pre-multi-lane list opens as). Ids are unique within a list, so there are no duplicate lane names to guard against.
// Display names come from the DB labels (useFilterLabels) in the UI; LANE_ALL_LABEL is the only name defined here.

export const LANE_IDS = ["all", "slayer", "jungle", "mid", "abyssal", "roaming"] as const satisfies readonly (HeroLane | "all")[];
export type LaneId = (typeof LANE_IDS)[number];
export const LANE_ALL: LaneId = "all";
export const LANE_ALL_LABEL = "ทั่วไป";
export const MAX_LANES = LANE_IDS.length;

export const isLaneId = (v: unknown): v is LaneId => typeof v === "string" && (LANE_IDS as readonly string[]).includes(v);

export interface TierLane {
  id: LaneId;
  rows: TierData;
}
export type TierLanes = TierLane[];

export const emptyLanes = (): TierLanes => [{ id: LANE_ALL, rows: emptyTierData() }];

/**
 * Reads any stored shape: v3 lanes, v2 rows, a bare rows array or the legacy fixed tiers. Everything that is not v3
 * becomes ONE lane "all" (nothing is lost, nothing is rewritten until the user saves). Never throws.
 */
export function parseLanes(raw: unknown): TierLanes {
  const o = raw as { v?: unknown; lanes?: unknown } | null;
  if (o && typeof o === "object" && !Array.isArray(o) && o.v === 3 && Array.isArray(o.lanes)) {
    const used = new Set<string>();
    const out: TierLanes = [];
    for (const item of o.lanes) {
      if (out.length >= MAX_LANES) break;
      if (!item || typeof item !== "object") continue;
      const l = item as { id?: unknown; rows?: unknown };
      if (!isLaneId(l.id) || used.has(l.id)) continue;
      used.add(l.id);
      out.push({ id: l.id, rows: parseTierData(l.rows) });
    }
    return out.length > 0 ? out : emptyLanes();
  }
  return [{ id: LANE_ALL, rows: parseTierData(raw) }];
}

/**
 * The jsonb written to the DB. A single "all" lane is written as v2, byte-for-byte what the app wrote before lanes
 * (older clients and a database without the v3 migration keep working); anything else is v3.
 */
export function serializeLanes(lanes: TierLanes) {
  const norm = parseLanes({ v: 3, lanes });
  if (norm.length === 1 && norm[0].id === LANE_ALL) return serializeTierData(norm[0].rows);
  return { v: 3 as const, lanes: norm.map((l) => ({ id: l.id, rows: l.rows })) };
}

/** Distinct heroes placed anywhere in the list (a hero on two lanes counts once; matches tier_hero_count in the DB). */
export const lanesHeroCount = (ls: TierLanes): number => new Set(ls.flatMap((l) => l.rows.flatMap((r) => r.heroes))).size;

/** Unsaved-change signature over EVERY lane. Which lane is open in the editor is not part of it. */
export const lanesSig = (ls: TierLanes): string => JSON.stringify(ls.map((l) => [l.id, tierSig(l.rows)]));

/** Never-saved work worth warning about: extra lanes, a non-default board, or any renamed/recolored/added row. */
export const lanesCustomized = (ls: TierLanes): boolean =>
  ls.length !== 1 || ls[0].id !== LANE_ALL || ls.some((l) => rowsCustomized(l.rows));

export const findLane = (ls: TierLanes, id: string | null | undefined): TierLane | undefined => ls.find((l) => l.id === id);

/** New empty board for `id`. No-op when the lane exists, is unknown, or the list is full. Other lanes are untouched. */
export function addLane(ls: TierLanes, id: LaneId): TierLanes {
  if (!isLaneId(id) || ls.length >= MAX_LANES || ls.some((l) => l.id === id)) return ls;
  return [...ls, { id, rows: emptyTierData() }];
}

/** Drops one lane and its board only. Keeps at least one lane. */
export function removeLane(ls: TierLanes, id: string): TierLanes {
  if (ls.length <= 1 || !ls.some((l) => l.id === id)) return ls;
  return ls.filter((l) => l.id !== id);
}

/** Applies a board edit (any of the pure helpers above) to ONE lane. Other lanes keep their identity. */
export function updateLaneRows(ls: TierLanes, id: string, fn: (rows: TierData) => TierData): TierLanes {
  let changed = false;
  const next = ls.map((l) => {
    if (l.id !== id) return l;
    const rows = fn(l.rows);
    if (rows === l.rows) return l;
    changed = true;
    return { ...l, rows };
  });
  return changed ? next : ls;
}

// ---- local draft (localStorage) ----

export interface Draft {
  name: string;
  patch: string;
  tiers: TierData;
}

/** Reads a stored editor draft. Version 1 = legacy fixed tiers, version 2 = rows. Anything malformed returns null. */
export function parseDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as { version?: unknown; name?: unknown; patch?: unknown; tiers?: unknown };
  if ((v.version !== 1 && v.version !== 2) || typeof v.name !== "string" || !v.tiers || typeof v.tiers !== "object") return null;
  return { name: v.name.slice(0, NAME_MAX), patch: typeof v.patch === "string" ? v.patch : "", tiers: parseTierData(v.tiers) };
}

export interface LaneDraft {
  name: string;
  patch: string;
  lanes: TierLanes;
}

/** Reads a stored draft of any version: 1 and 2 open as one lane "all"; 3 = { version: 3, name, patch, lanes }. */
export function parseLaneDraft(raw: unknown): LaneDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as { version?: unknown; name?: unknown; patch?: unknown; lanes?: unknown };
  if (v.version === 3) {
    if (typeof v.name !== "string" || !Array.isArray(v.lanes)) return null;
    return { name: v.name.slice(0, NAME_MAX), patch: typeof v.patch === "string" ? v.patch : "", lanes: parseLanes({ v: 3, lanes: v.lanes }) };
  }
  const d = parseDraft(raw);
  return d && { name: d.name, patch: d.patch, lanes: [{ id: LANE_ALL, rows: d.tiers }] };
}
