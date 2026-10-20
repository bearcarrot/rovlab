// Pure helpers for the community item usage numbers returned by the `hero_item_usage` RPC (no React, no network).
// pick rate = observations containing the item / eligible observations. It is how OFTEN an item is built, not proof that
// it causes wins. Two scopes with DIFFERENT denominators, never mixed (see supabase/migrations/20261020b_item_level_observations.sql):
//   itemLevel: eligible = observations with >= 1 verified item. An empty/unverified slot is not evidence of "not bought",
//              so the rate is a lower bound.
//   complete:  eligible = observations with all 6 slots verified.

export interface ItemUsageRow {
  itemId: string;
  slug: string;
  matches: number;
  /** percent, 1 decimal, recomputed from matches/eligible so the UI never shows a number that disagrees with the counts */
  pickRate: number;
  /** slot position (1-6) -> observations with the item in that slot (slot share, a different measure from pick rate) */
  slots: Record<number, number>;
}

/** One scope's statistics. */
export interface HeroItemUsage {
  eligible: number;
  users: number;
  /** true when too few distinct users shared: the server returns no items then */
  suppressed: boolean;
  items: ItemUsageRow[];
}

export interface HeroItemUsageSet {
  itemLevel: HeroItemUsage;
  complete: HeroItemUsage;
}

/** Below this many eligible observations the list is shown with a "small sample" warning. */
export const SMALL_SAMPLE = 20;

const EMPTY: HeroItemUsage = { eligible: 0, users: 0, suppressed: true, items: [] };
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Anything unexpected becomes the empty/suppressed result: a malformed response must not render as real statistics. */
export function parseHeroItemStats(raw: unknown): HeroItemUsage {
  const r = raw as { eligible?: unknown; users?: unknown; suppressed?: unknown; items?: unknown } | null;
  if (!r || typeof r !== "object" || !isCount(r.eligible) || !isCount(r.users)) return EMPTY;
  if (r.suppressed !== false || r.eligible === 0 || !Array.isArray(r.items)) {
    return { eligible: r.eligible, users: r.users, suppressed: true, items: [] };
  }
  const eligible = r.eligible;
  const items: ItemUsageRow[] = [];
  for (const it of r.items as Record<string, unknown>[]) {
    if (typeof it?.item_id !== "string" || typeof it.slug !== "string" || !isCount(it.matches)) continue;
    if (it.matches > eligible) continue; // impossible: an item cannot appear in more observations than exist
    const slots: Record<number, number> = {};
    for (const [k, v] of Object.entries((it.slots ?? {}) as Record<string, unknown>)) {
      if (isCount(v) && Number(k) >= 1 && Number(k) <= 6) slots[Number(k)] = v;
    }
    items.push({
      itemId: it.item_id,
      slug: it.slug,
      matches: it.matches,
      pickRate: Math.round((it.matches * 1000) / eligible) / 10,
      slots,
    });
  }
  items.sort((a, b) => b.matches - a.matches);
  return { eligible, users: r.users, suppressed: false, items };
}

export function parseHeroItemUsage(raw: unknown): HeroItemUsageSet {
  const r = (raw && typeof raw === "object" ? raw : {}) as { item_level?: unknown; complete?: unknown };
  return { itemLevel: parseHeroItemStats(r.item_level), complete: parseHeroItemStats(r.complete) };
}
