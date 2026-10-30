import type { CounterRel, DraftRelations, SynergyRel } from "@/services/draft";
import type { Combo } from "@/services/combos";
import type { UserCounterPick } from "@/services/userCounterPicks";

// Data source for the two relation sets Draft Assistant feeds into recommendPicks / describeDraft.
// "recommended" = official data (hero_counters / hero_synergies via getDraftRelations), unchanged. This stays the default.
// "mine" = the signed-in user's own data ONLY: there is deliberately no fallback to official data when it is empty.
// "all" = official data + the user's own together (the same pair in both: the user's own row wins). Signed out = official only.
export type DraftSource = "recommended" | "mine" | "all";

// Dropdown order: ทั้งหมด / แนะนำ / ของฉัน (the default value, used by usePersistedState, is still "recommended")
export const SOURCE_OPTIONS: { value: DraftSource; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "recommended", label: "แนะนำ" },
  { value: "mine", label: "ของฉัน" },
];

export function parseSource(v: unknown): DraftSource {
  return v === "mine" || v === "all" ? v : "recommended";
}

export function personalCounterRels(picks: UserCounterPick[]): CounterRel[] {
  return picks.map((p) => ({ victimId: p.enemyHeroId, counterId: p.counterHeroId, strength: p.strength, reason: p.reason, laneTip: "" }));
}

// A combo of 2-5 heroes becomes every pair among them, because the recommender models synergy as hero pairs.
// The note (or name) is the reason shown on the card.
export function personalSynergyRels(combos: Combo[]): SynergyRel[] {
  const out: SynergyRel[] = [];
  for (const c of combos) {
    const reason = (c.note || c.name).trim();
    for (let i = 0; i < c.heroIds.length; i++) {
      for (let j = i + 1; j < c.heroIds.length; j++) out.push({ heroId: c.heroIds[i], partnerId: c.heroIds[j], reason });
    }
  }
  return out;
}

// "all": one row per (victim, counter) pair — the recommender sums exposure per row, so duplicates must not reach it. Later rows (the user's) win.
function mergeCounters(official: CounterRel[], mine: CounterRel[]): CounterRel[] {
  const byPair = new Map<string, CounterRel>();
  for (const c of [...official, ...mine]) byPair.set(`${c.victimId}>${c.counterId}`, c);
  return [...byPair.values()];
}

// "all": synergy is two-way, so a pair is the same pair in either order
function mergeSynergies(official: SynergyRel[], mine: SynergyRel[]): SynergyRel[] {
  const byPair = new Map<string, SynergyRel>();
  for (const s of [...official, ...mine]) byPair.set([s.heroId, s.partnerId].sort().join("|"), s);
  return [...byPair.values()];
}

export interface SourceInput {
  official: DraftRelations | undefined;
  counterSource: DraftSource;
  comboSource: DraftSource;
  /** Personal data; pass [] until loaded or when signed out. Only read for a source set to "mine" or "all". */
  myCounters: UserCounterPick[];
  myCombos: Combo[];
}

// Official data is undefined while still loading; a "mine" half never depends on it, so each half is resolved on its own.
// An "all" half needs official data, so it waits for it like "recommended" does.
export function resolveRelations(i: SourceInput): DraftRelations | undefined {
  const counters =
    i.counterSource === "mine"
      ? personalCounterRels(i.myCounters)
      : i.counterSource === "all"
        ? i.official && mergeCounters(i.official.counters, personalCounterRels(i.myCounters))
        : i.official?.counters;
  const synergies =
    i.comboSource === "mine"
      ? personalSynergyRels(i.myCombos)
      : i.comboSource === "all"
        ? i.official && mergeSynergies(i.official.synergies, personalSynergyRels(i.myCombos))
        : i.official?.synergies;
  if (counters === undefined || synergies === undefined) return undefined;
  return { counters, synergies };
}

// True when some saved counter has one of the enemy heroes currently picked as its victim.
export function hasCounterForEnemies(myCounters: UserCounterPick[], enemyIds: string[]): boolean {
  const enemies = new Set(enemyIds);
  return myCounters.some((p) => enemies.has(p.enemyHeroId));
}

// True when some saved combo contains at least one hero already on my team.
export function hasComboForTeam(myCombos: Combo[], teamIds: string[]): boolean {
  const team = new Set(teamIds);
  return myCombos.some((c) => c.heroIds.some((id) => team.has(id)));
}
