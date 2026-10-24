import type { CounterEntry, SynergyEntry } from "../types/hero.ts";

type Rel = {
  counters: { victimId: string; counterId: string; strength: CounterEntry["strength"]; reason: string; laneTip: string }[];
  synergies: { heroId: string; partnerId: string; reason: string }[];
};
type Chip = { id: string; slug: string; name: string; icon: string };

// One hero's counter/synergy lists from the all-heroes relations (draft-relations) + hero list that other pages already cached.
// Returns null when a referenced hero is not in the list, so the caller falls back to the per-hero queries.
export function relationsForHero(heroId: string, rel: Rel, heroes: Chip[]) {
  const byId = new Map(heroes.map((h) => [h.id, h]));
  let missing = false;
  const chip = (id: string) => {
    const h = byId.get(id);
    if (!h) missing = true;
    return { heroSlug: h?.slug ?? "", heroNameTh: h?.name, heroIcon: h?.icon || undefined };
  };
  const counteredBy: CounterEntry[] = rel.counters
    .filter((c) => c.victimId === heroId)
    .map((c) => ({ ...chip(c.counterId), strength: c.strength, reason: c.reason, laneTip: c.laneTip }));
  const countersAgainst: CounterEntry[] = rel.counters
    .filter((c) => c.counterId === heroId)
    .map((c) => ({ ...chip(c.victimId), strength: c.strength, reason: c.reason, laneTip: c.laneTip }));
  const synergies: SynergyEntry[] = rel.synergies
    .filter((s) => s.heroId === heroId)
    .map((s) => ({ ...chip(s.partnerId), reason: s.reason }));
  return missing ? null : { counteredBy, countersAgainst, synergies };
}
