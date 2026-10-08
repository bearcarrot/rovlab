// Lane-aware recommendations: a team needs one hero per lane, so once a lane is covered the
// recommender stops suggesting more heroes for that lane and points at the lanes still missing.
// Pure functions (no React) so they can be unit tested.

const CANONICAL_ORDER = ["slayer", "jungle", "mid", "abyssal", "roaming"];

/** All lane codes present in `laneLists`, in the usual lane order (unknown codes last). */
export function collectLanes(laneLists: string[][]): string[] {
  const seen = new Set<string>();
  for (const l of laneLists) for (const x of l) seen.add(x);
  const rank = (x: string) => {
    const i = CANONICAL_ORDER.indexOf(x);
    return i === -1 ? CANONICAL_ORDER.length : i;
  };
  return [...seen].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Lanes nobody on the team covers yet. Each picked hero can fill one lane, so flexible heroes are
 * assigned with a maximum bipartite matching (e.g. a jungle/mid hero + a mid-only hero cover both).
 */
export function getMissingLanes(picked: string[][], allLanes: string[]): string[] {
  const laneOwner = new Map<string, number>(); // lane -> index of the hero filling it
  const assign = (hero: number, seen: Set<string>): boolean => {
    for (const lane of picked[hero]) {
      if (!allLanes.includes(lane) || seen.has(lane)) continue;
      seen.add(lane);
      const owner = laneOwner.get(lane);
      if (owner === undefined || assign(owner, seen)) {
        laneOwner.set(lane, hero);
        return true;
      }
    }
    return false;
  };
  picked.forEach((_, i) => assign(i, new Set()));
  return allLanes.filter((l) => !laneOwner.has(l));
}

/**
 * Keep only candidates that can play a missing lane. Candidates with no lane data are kept (unknown, not
 * wrong). If that would leave nothing, return everything rather than an empty list.
 */
export function filterByMissingLanes<T>(items: T[], lanesOf: (t: T) => string[], missing: string[]): T[] {
  if (missing.length === 0) return items;
  const kept = items.filter((i) => {
    const lanes = lanesOf(i);
    return lanes.length === 0 || lanes.some((l) => missing.includes(l));
  });
  return kept.length > 0 ? kept : items;
}
