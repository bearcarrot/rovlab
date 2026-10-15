// Pure helpers for the community item usage numbers returned by the `hero_item_stats` RPC (no React, no network).
// pick rate = observations containing the item / eligible observations. It is how OFTEN an item is built, not proof that
// it causes wins. Observations are opt-in, fully read 6-slot builds (see supabase/migrations/20261016b_match_item_obs.sql).

export interface ItemUsageRow {
  itemId: string;
  slug: string;
  matches: number;
  /** percent, 1 decimal, recomputed from matches/eligible so the UI never shows a number that disagrees with the counts */
  pickRate: number;
  /** slot position (1-6) -> observations with the item in that slot (slot share, a different measure from pick rate) */
  slots: Record<number, number>;
}

export interface HeroItemUsage {
  eligible: number;
  users: number;
  /** true when too few distinct users shared: the server returns no items then */
  suppressed: boolean;
  items: ItemUsageRow[];
}

/** Below this many eligible builds the list is shown with a "small sample" warning. */
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
    if (it.matches > eligible) continue; // impossible: an item cannot appear in more builds than exist
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
