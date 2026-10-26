// Pure helpers for the shape of a tier list (editor, My Tier Lists, Community snapshots, share images).
// Kept dependency-free so it can be unit tested.
//
// Rows are ordered and user-defined: { id, label, color, heroes[] }. Hero ids only; icons/names are resolved
// from the hero database when rendering.
// Stored in the DB (jsonb) as { "v": 2, "rows": [...] }. The legacy shape { "S+": [...], S, A, B, C } is still
// read everywhere (old saved lists and Community snapshots are never rewritten) and maps to five default rows.
//
// Optional per-list setting "allowDuplicates" (UI: อนุญาตให้ฮีโร่อยู่ได้หลาย Tier). Stored as { "v": 2, "rows": [...], "dup": true }
// and ONLY written when ON, so every list saved with the setting OFF is byte-identical to before. Missing / non-true = OFF.
// OFF: a hero id may occur once on the whole board. ON: once per row (it may appear in several rows).
//
// Optional independent per-lane placements (laneAssign.ts): { v: 2, rows, lanes: { "<lane>": { "<rowId>": [heroId] } } }.
// ONLY written once the user edits a lane, so every list that never used it stays byte-identical to before.

export const NAME_MAX = 40;
export const TIER_LABEL_MAX = 12;
export const MAX_ROWS = 20;
export const MAX_HEROES = 200; // placements across the whole board (same cap as before; with duplicates ON it counts every placement)
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

/** The persisted setting inside a stored v2 document. Only a literal boolean true turns it on (anything else = OFF). */
export const readAllowDuplicates = (raw: unknown): boolean => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as { v?: unknown; dup?: unknown };
  return o.v === 2 && o.dup === true;
};

/**
 * Never trust jsonb / localStorage: accepts the v2 shape, a bare rows array, or the legacy fixed-key object.
 * `allowDuplicates` defaults to the flag stored in `raw` (OFF when absent). OFF = each hero once on the whole board
 * (first occurrence wins, as before); ON = each hero once per row.
 */
export function parseTierData(raw: unknown, allowDuplicates: boolean = readAllowDuplicates(raw)): TierData {
  if (!raw || typeof raw !== "object") return emptyTierData();
  const seen = new Set<string>(); // OFF: whole board
  let placements = 0; // ON: every placement counts toward MAX_HEROES
  const takeHeroes = (list: unknown): string[] => {
    const out: string[] = [];
    if (!Array.isArray(list)) return out;
    const inRow = new Set<string>();
    for (const id of list) {
      if (typeof id !== "string" || id.length === 0 || id.length > HERO_ID_MAX) continue;
      if (allowDuplicates) {
        if (inRow.has(id) || placements >= MAX_HEROES) continue;
        inRow.add(id);
        placements++;
      } else {
        if (seen.has(id) || seen.size >= MAX_HEROES) continue;
        seen.add(id);
      }
      out.push(id);
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

/**
 * The jsonb written to the DB. Normalizes first, so invalid input can never reach the CHECK constraint.
 * `dup: true` is added only when the setting is ON; OFF output is exactly the pre-existing { v: 2, rows }.
 */
export function serializeTierData(
  rows: TierData,
  allowDuplicates = false,
  lanes: LaneAssign | null = null
): { v: 2; rows: TierData; dup?: true; lanes?: LaneAssign } {
  const norm = parseTierData(rows, allowDuplicates);
  const l = parseLanes(lanes, norm);
  return { v: 2 as const, rows: norm, ...(allowDuplicates ? { dup: true as const } : {}), ...(l ? { lanes: l } : {}) };
}

/** The per-lane layer stored in a v2 document (null = none). Needs the parsed rows to drop unknown row ids. */
export const readLanes = (raw: unknown, rows: TierData): LaneAssign | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as { v?: unknown; lanes?: unknown };
  return o.v === 2 ? parseLanes(o.lanes, rows) : null;
};

/** Number of placements (a hero in two rows counts twice). Used for the MAX_HEROES cap and "is the board empty". */
export const tierHeroCount = (d: TierData): number => d.reduce((n, r) => n + r.heroes.length, 0);

/** Number of different heroes placed (matches tier_hero_count in the DB). */
export const distinctHeroCount = (d: TierData): number => new Set(d.flatMap((r) => r.heroes)).size;

/** Placements beyond the first one of each hero: what turning the setting OFF would remove. */
export const duplicatePlacementCount = (d: TierData): number => tierHeroCount(d) - distinctHeroCount(d);

/** Signature for unsaved-change detection: row ids, labels, colors, order and hero placement. */
export const tierSig = (d: TierData): string => JSON.stringify(d.map((r) => [r.id, r.label, r.color, r.heroes]));

/** Whole-list signature. With the setting OFF it is exactly the signature used before the setting existed. */
export const listSig = (name: string, d: TierData, allowDuplicates: boolean, laneSig = ""): string =>
  JSON.stringify([name.trim(), tierSig(d), ...(allowDuplicates || laneSig ? [allowDuplicates] : []), ...(laneSig ? [laneSig] : [])]);

/** True when the rows differ from the default five (ignoring heroes), e.g. renamed, recolored, added, reordered. */
export const rowsCustomized = (d: TierData): boolean =>
  JSON.stringify(d.map((r) => [r.id, r.label, r.color])) !== JSON.stringify(DEFAULT_ROWS.map((r) => [r.id, r.label, r.color]));

// ---- editing operations (all pure; return the same array when nothing changes) ----

export const findTier = (d: TierData, heroId: string): string | null => d.find((r) => r.heroes.includes(heroId))?.id ?? null;

/** Every row the hero is in, in row order (more than one only when duplicates are allowed). */
export const findTiers = (d: TierData, heroId: string): string[] => d.filter((r) => r.heroes.includes(heroId)).map((r) => r.id);

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

/**
 * Put a hero into a row. OFF = exactly moveHero (leaves its previous row).
 * ON = adds a placement and keeps the others; a hero already in the target row is never added twice
 * (with an index it is repositioned inside the row, without one nothing changes).
 */
export function placeHero(d: TierData, heroId: string, toRowId: string, index?: number, allowDuplicates = false): TierData {
  if (!allowDuplicates) return moveHero(d, heroId, toRowId, index);
  const target = d.find((r) => r.id === toRowId);
  if (!target) return d;
  const already = target.heroes.includes(heroId);
  if (already && index === undefined) return d;
  if (!already && tierHeroCount(d) >= MAX_HEROES) return d;
  return d.map((r) => {
    if (r.id !== toRowId) return r;
    const heroes = r.heroes.filter((x) => x !== heroId);
    heroes.splice(index === undefined ? heroes.length : Math.max(0, Math.min(index, heroes.length)), 0, heroId);
    return { ...r, heroes };
  });
}

/** Removes the hero from ONE row; its placements in other rows are untouched. */
export function removeFromRow(d: TierData, heroId: string, rowId: string): TierData {
  if (!d.some((r) => r.id === rowId && r.heroes.includes(heroId))) return d;
  return d.map((r) => (r.id === rowId ? { ...r, heroes: r.heroes.filter((x) => x !== heroId) } : r));
}

/** Turning the setting OFF: each hero keeps only its first (topmost) row. Same array when there is nothing to remove. */
export function collapseDuplicates(d: TierData): TierData {
  const seen = new Set<string>();
  let changed = false;
  const out = d.map((r) => {
    const heroes: string[] = [];
    for (const id of r.heroes) {
      if (seen.has(id)) continue;
      seen.add(id);
      heroes.push(id);
    }
    if (heroes.length === r.heroes.length) return r;
    changed = true;
    return { ...r, heroes };
  });
  return changed ? out : d;
}

/** Heroes offered in the selection grid: OFF hides placed heroes (as before); ON keeps every hero available. */
export function poolHeroes<T extends { id: string }>(heroes: T[], d: TierData, allowDuplicates: boolean): T[] {
  if (allowDuplicates) return heroes;
  const placed = new Set(d.flatMap((r) => r.heroes));
  return heroes.filter((h) => !placed.has(h.id));
}

/** Move left/right inside a row (buttons instead of dragging: works on touch and keyboard). `rowId` picks the row when the hero is in several. */
export function shiftHero(d: TierData, heroId: string, dir: -1 | 1, rowId?: string): TierData {
  const row = d.find((r) => r.heroes.includes(heroId) && (rowId === undefined || r.id === rowId));
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

/** Heroes of a deleted row lose that placement (with duplicates ON their other rows are untouched). Keeps at least one row. */
export const deleteRow = (d: TierData, rowId: string): TierData => (d.length <= 1 ? d : d.filter((r) => r.id !== rowId));

// ---- local draft (localStorage) ----

export interface Draft {
  name: string;
  patch: string;
  tiers: TierData;
  allowDuplicates: boolean;
  lanes: LaneAssign | null;
}

/** Reads a stored editor draft. Version 1 = legacy fixed tiers, version 2 = rows (+ optional allowDuplicates). Anything malformed returns null. */
export function parseDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as { version?: unknown; name?: unknown; patch?: unknown; tiers?: unknown; allowDuplicates?: unknown; lanes?: unknown };
  if ((v.version !== 1 && v.version !== 2) || typeof v.name !== "string" || !v.tiers || typeof v.tiers !== "object") return null;
  const allowDuplicates = v.version === 2 && v.allowDuplicates === true;
  const tiers = parseTierData(v.tiers, allowDuplicates);
  return {
    name: v.name.slice(0, NAME_MAX),
    patch: typeof v.patch === "string" ? v.patch : "",
    tiers,
    allowDuplicates,
    lanes: v.version === 2 ? parseLanes(v.lanes, tiers) : null,
  };
}

// ---- independent per-lane placements (kept in this file so it stays dependency-free and unit-testable) ----
// Independent per-lane Tier placements of a custom tier list (My Tier Lists / Community snapshots).
// Stored next to the rows in the same jsonb: { v: 2, rows: [...], lanes: { "<lane>": { "<rowId>": ["heroId", ...] } } }.
// `rows` still defines the Tiers (id, label, color, order) and the traditional board; `lanes` is a separate layer.
// Rules: one Tier per hero per lane; the same hero may be in any number of lanes, each with its own Tier.
// Any hero may go in any lane: nothing here looks at hero role / lane metadata (that is only used by seedLanes, once, to
// copy a legacy list into lanes). Dependency-free so it can be unit tested.


export type LaneAssign = Record<string, Record<string, string[]>>; // lane -> rowId -> hero ids

export const MAX_LANES = 12;
export const MAX_LANE_PLACEMENTS = 600; // across all lanes (keeps the jsonb far below the 64 KiB cap)
const LANE_RE = /^[a-z0-9_-]{1,32}$/;

export const laneCount = (l: LaneAssign | null | undefined): number => (l ? Object.keys(l).length : 0);
export const lanePlacementCount = (l: LaneAssign): number =>
  Object.values(l).reduce((n, rows) => n + Object.values(rows).reduce((m, h) => m + h.length, 0), 0);

/** Never trust jsonb / localStorage. Unknown row ids, bad lane codes, bad hero ids and repeats inside a lane are dropped
 *  (first occurrence wins, in row order). Returns null when nothing valid is left, so "no lane edits" stays absent. */
export function parseLanes(raw: unknown, rows: TierData): LaneAssign | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const order = rows.map((r) => r.id);
  const out: LaneAssign = {};
  let total = 0;
  for (const [lane, byRow] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_LANES) break;
    if (!LANE_RE.test(lane) || !byRow || typeof byRow !== "object" || Array.isArray(byRow)) continue;
    const seen = new Set<string>();
    const cells: Record<string, string[]> = {};
    for (const rowId of order) {
      const list = (byRow as Record<string, unknown>)[rowId];
      if (!Array.isArray(list)) continue;
      const heroes: string[] = [];
      for (const id of list) {
        if (typeof id !== "string" || id.length === 0 || id.length > HERO_ID_MAX || seen.has(id) || total >= MAX_LANE_PLACEMENTS) continue;
        seen.add(id);
        total++;
        heroes.push(id);
      }
      if (heroes.length > 0) cells[rowId] = heroes;
    }
    if (Object.keys(cells).length > 0) out[lane] = cells;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** The Tier row id a hero has in a lane (null = not in that lane). */
export function laneTierOf(l: LaneAssign | null | undefined, lane: string, heroId: string): string | null {
  const cells = l?.[lane];
  if (!cells) return null;
  for (const [rowId, heroes] of Object.entries(cells)) if (heroes.includes(heroId)) return rowId;
  return null;
}

/**
 * Put a hero in `rowId` of ONE lane (adds it, or moves it from its current Tier in that lane). `rowId` null removes it from
 * that lane. Other lanes are never touched. Returns the same object when nothing changes or the target row does not exist.
 */
export function setLaneTier(l: LaneAssign | null | undefined, rows: TierData, lane: string, heroId: string, rowId: string | null): LaneAssign {
  const base = l ?? {};
  if (!LANE_RE.test(lane)) return base;
  if (rowId !== null && !rows.some((r) => r.id === rowId)) return base;
  const cur = laneTierOf(base, lane, heroId);
  if (cur === rowId) return base;
  if (cur === null && lanePlacementCount(base) >= MAX_LANE_PLACEMENTS) return base;
  if (cur === null && !(lane in base) && laneCount(base) >= MAX_LANES) return base;
  const cells: Record<string, string[]> = {};
  for (const [id, heroes] of Object.entries(base[lane] ?? {})) {
    const kept = heroes.filter((x) => x !== heroId);
    if (kept.length > 0) cells[id] = kept;
  }
  if (rowId !== null) cells[rowId] = [...(cells[rowId] ?? []), heroId];
  const next = { ...base };
  if (Object.keys(cells).length > 0) next[lane] = cells;
  else delete next[lane];
  return next;
}

/** Heroes of a lane per row, in the order of `rows` (every row present, maybe empty). */
export const laneRows = (l: LaneAssign | null | undefined, rows: TierData, lane: string): { id: string; heroes: string[] }[] =>
  rows.map((r) => ({ id: r.id, heroes: l?.[lane]?.[r.id] ?? [] }));

/**
 * One-time copy of a legacy list into lanes: each placed hero goes, with the Tier it has on the board, into every lane in
 * `laneOf(hero)` that is one of `lanes`. A hero with none of those lanes is not invented anywhere. Used the first time the user
 * edits a lane; after that the stored lanes are the only source of truth.
 */
export function seedLanes<H extends { id: string }>(rows: TierData, byId: ReadonlyMap<string, H>, laneOf: (h: H) => readonly string[], lanes: readonly string[]): LaneAssign {
  const out: LaneAssign = {};
  for (const r of rows) {
    for (const id of r.heroes) {
      const h = byId.get(id);
      if (!h) continue;
      for (const lane of new Set(laneOf(h))) {
        if (!lanes.includes(lane) || !LANE_RE.test(lane)) continue;
        const cells = (out[lane] ??= {});
        if (Object.values(cells).some((x) => x.includes(id))) continue;
        (cells[r.id] ??= []).push(id);
      }
    }
  }
  return parseLanes(out, rows) ?? {};
}

/** Signature piece for unsaved-change detection (empty string = no lane edits, so old signatures stay unchanged). */
export const laneSig = (l: LaneAssign | null | undefined): string => (l && laneCount(l) > 0 ? JSON.stringify(Object.entries(l).sort(([a], [b]) => (a < b ? -1 : 1))) : "");

/** A deleted Tier row takes its lane placements with it (its id can be reused by a new row). */
export function dropRowFromLanes(l: LaneAssign | null | undefined, rowId: string): LaneAssign | null {
  if (!l) return null;
  const out: LaneAssign = {};
  for (const [lane, cells] of Object.entries(l)) {
    const { [rowId]: _gone, ...rest } = cells;
    if (Object.keys(rest).length > 0) out[lane] = rest;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Hero ids placed in any lane (with repeats). */
export const laneHeroIds = (l: LaneAssign | null | undefined): string[] =>
  l ? Object.values(l).flatMap((cells) => Object.values(cells).flat()) : [];
