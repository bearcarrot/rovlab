// Pure helpers for the shape of a tier list (editor, My Tier Lists, Community snapshots, share images).
// Kept dependency-free so it can be unit tested.
//
// Rows are ordered and user-defined: { id, label, color, heroes[] }. Hero ids only; icons/names are resolved
// from the hero database when rendering.
// Stored in the DB (jsonb) as { "v": 2, "rows": [...] }. The legacy shape { "S+": [...], S, A, B, C } is still
// read everywhere (old saved lists and Community snapshots are never rewritten) and maps to five default rows.

export const NAME_MAX = 40;
export const TIER_LABEL_MAX = 12;
export const MAX_ROWS = 20;
export const MAX_HEROES = 200; // across the whole board (same cap as before)
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
  { id: "s-plus", label: "S+", color: "#EF4444" },
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
