// Pure helpers for the cloud (My Tier Lists / Community) shape of a tier list.
// Kept dependency-free so it can be unit tested. Shape: { "S+": [heroId...], S, A, B, C }.

export const TIER_KEYS = ["S+", "S", "A", "B", "C"] as const;
export type TierKey = (typeof TIER_KEYS)[number];
export type TierData = Record<TierKey, string[]>;

export const emptyTierData = (): TierData => ({ "S+": [], S: [], A: [], B: [], C: [] });

/** Never trust jsonb coming back from the DB: keep known tiers, string ids only, each hero once. */
export function parseTierData(raw: unknown): TierData {
  const out = emptyTierData();
  if (!raw || typeof raw !== "object") return out;
  const seen = new Set<string>();
  for (const t of TIER_KEYS) {
    const list = (raw as Record<string, unknown>)[t];
    if (!Array.isArray(list)) continue;
    for (const id of list) {
      if (typeof id === "string" && id.length > 0 && id.length <= 64 && !seen.has(id) && seen.size < 200) {
        seen.add(id);
        out[t].push(id);
      }
    }
  }
  return out;
}

export const tierHeroCount = (d: TierData): number => TIER_KEYS.reduce((n, t) => n + d[t].length, 0);
