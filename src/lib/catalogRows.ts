import type { CatalogItem, CatalogRune } from "../services/gameCatalog.ts";

// Pure views over the shared raw catalog rows (services/gameCatalog.ts). Kept free of app imports so tests can load it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// Public Game Data only ever shows rows an admin verified against the game
export const isVerified = (r: Row): boolean => r.verified_at != null;

export const toCatalogItems = (rows: Row[]): CatalogItem[] =>
  rows.filter(isVerified).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    nameTh: r.name_th,
    cost: r.cost,
    tier: r.tier ?? null,
    roleTags: r.role_tags ?? [],
    stats: r.stats ?? [],
    passive: r.passive ?? "",
    icon: r.icon_url ?? "",
  }));

export const toCatalogRunes = (rows: Row[]): CatalogRune[] =>
  rows.filter(isVerified).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    color: r.color ?? null,
    icon: r.icon_url ?? "",
  }));

// Builds (Hero Detail / Item Build) resolve every item row, verified or not, most expensive first (stable: ties keep name order)
export const byCostDesc = <T extends { cost: number }>(list: T[]): T[] => [...list].sort((a, b) => b.cost - a.cost);
