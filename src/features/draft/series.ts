// Draft Series engine (Phase 1): Series / Game state + per-team Global Ban Pick.
// Pure functions, no React/Supabase. Existing analyzeTeam/recommendPicks are untouched.
//
// Rules (see brief):
// - Global restriction is per team: heroes a team PICKED in earlier games of the series are
//   unavailable to that same team only. The opponent may still pick them.
// - Bans never create a global restriction (they only apply to the game they were made in).
// - Game 1 has no restriction. Restrictions are derived from earlier games, never stored.

export type TeamKey = "mine" | "enemy";
export type HeroKey = string; // hero slug (same key the Draft page already uses)
export type SeriesFormat = "single" | "bo3" | "bo5" | "bo7";
export type Game7Rule = "normal" | "global" | "ultimate";

// picks is positional (length TEAM_SIZE, null = empty slot) so it maps 1:1 onto the page's slot arrays.
export type TeamDraft = { bans: HeroKey[]; picks: (HeroKey | null)[] };
export type DraftGame = { gameNumber: number; mine: TeamDraft; enemy: TeamDraft };

export type DraftSeries = {
  format: SeriesFormat;
  globalBanPick: boolean;
  // Only meaningful for bo7. Not hard-coded: rulesets differ per tournament.
  game7Rule: Game7Rule;
  games: DraftGame[];
};

export const GAME_COUNT: Record<SeriesFormat, number> = { single: 1, bo3: 3, bo5: 5, bo7: 7 };
export const TEAM_SIZE = 5;

const emptyTeam = (): TeamDraft => ({ bans: [], picks: Array<HeroKey | null>(TEAM_SIZE).fill(null) });
export const emptyGame = (gameNumber: number): DraftGame => ({
  gameNumber,
  mine: emptyTeam(),
  enemy: emptyTeam(),
});

export function createSeries(
  format: SeriesFormat = "single",
  opts: { globalBanPick?: boolean; game7Rule?: Game7Rule } = {}
): DraftSeries {
  return {
    format,
    globalBanPick: format === "single" ? false : (opts.globalBanPick ?? true),
    game7Rule: opts.game7Rule ?? "normal",
    games: Array.from({ length: GAME_COUNT[format] }, (_, i) => emptyGame(i + 1)),
  };
}

export function getGame(series: DraftSeries, gameNumber: number): DraftGame | undefined {
  return series.games.find((g) => g.gameNumber === gameNumber);
}

/** Whether global restriction is in force for this game (Game 1, single, GBP off, BO7 game 7 normal => false). */
export function isGlobalRuleActive(series: DraftSeries, gameNumber: number): boolean {
  if (!series.globalBanPick || series.format === "single" || gameNumber <= 1) return false;
  if (series.format === "bo7" && gameNumber === 7 && series.game7Rule !== "global") return false;
  return true;
}

/** Heroes `team` picked in earlier games. Empty when the rule is not active. Bans are ignored. */
export function getGlobalRestrictedHeroes(args: {
  series: DraftSeries;
  gameNumber: number;
  team: TeamKey;
}): Set<HeroKey> {
  const { series, gameNumber, team } = args;
  const out = new Set<HeroKey>();
  if (!isGlobalRuleActive(series, gameNumber)) return out;
  for (const g of series.games) {
    if (g.gameNumber >= gameNumber) continue;
    for (const h of g[team].picks) if (h) out.add(h);
  }
  return out;
}

/** Heroes unavailable in the current game regardless of team: current picks (both teams) + current bans. */
export function getCurrentGameTaken(game: DraftGame): Set<HeroKey> {
  const all = [...game.mine.picks, ...game.enemy.picks, ...game.mine.bans, ...game.enemy.bans];
  return new Set(all.filter((h): h is HeroKey => h !== null));
}

/**
 * Pool a given team may pick from:
 *   !pickedInCurrentGame && !bannedInCurrentGame && !globalRestrictedForTeam
 * Search/role filters stay in the page (filters.match / query), applied on top of this.
 */
export function getAvailableHeroes<T extends { slug: HeroKey }>(args: {
  heroes: T[];
  series: DraftSeries;
  gameNumber: number;
  team: TeamKey;
}): T[] {
  const { heroes, series, gameNumber, team } = args;
  const game = getGame(series, gameNumber);
  const taken = game ? getCurrentGameTaken(game) : new Set<HeroKey>();
  const restricted = getGlobalRestrictedHeroes({ series, gameNumber, team });
  return heroes.filter((h) => !taken.has(h.slug) && !restricted.has(h.slug));
}

export type Conflict = { gameNumber: number; team: TeamKey; hero: HeroKey };

/**
 * After editing an earlier game, a later pick may now be illegal for its team.
 * Returns those picks so the UI can warn (we never silently delete user data).
 */
export function findRestrictionConflicts(series: DraftSeries): Conflict[] {
  const out: Conflict[] = [];
  for (const g of series.games) {
    for (const team of ["mine", "enemy"] as TeamKey[]) {
      const restricted = getGlobalRestrictedHeroes({ series, gameNumber: g.gameNumber, team });
      for (const hero of g[team].picks) {
        if (hero && restricted.has(hero)) out.push({ gameNumber: g.gameNumber, team, hero });
      }
    }
  }
  return out;
}

// ---------- immutable updaters ----------

function mapGame(series: DraftSeries, gameNumber: number, fn: (g: DraftGame) => DraftGame): DraftSeries {
  return { ...series, games: series.games.map((g) => (g.gameNumber === gameNumber ? fn(g) : g)) };
}

/** Set (or clear with null) a pick slot. Slots are positional, matching the page's 5-slot arrays. */
export function setPickAt(
  series: DraftSeries,
  gameNumber: number,
  team: TeamKey,
  index: number,
  hero: HeroKey | null
): DraftSeries {
  return mapGame(series, gameNumber, (g) => {
    const picks = [...g[team].picks];
    picks[index] = hero;
    return { ...g, [team]: { ...g[team], picks } };
  });
}

export function addBan(series: DraftSeries, gameNumber: number, team: TeamKey, hero: HeroKey): DraftSeries {
  return mapGame(series, gameNumber, (g) =>
    g[team].bans.includes(hero) ? g : { ...g, [team]: { ...g[team], bans: [...g[team].bans, hero] } }
  );
}

export function removeBan(series: DraftSeries, gameNumber: number, team: TeamKey, hero: HeroKey): DraftSeries {
  return mapGame(series, gameNumber, (g) => ({
    ...g,
    [team]: { ...g[team], bans: g[team].bans.filter((h) => h !== hero) },
  }));
}

/** Reset Game: clears only this game's picks/bans. Earlier history stays; later restrictions recompute. */
export function resetGame(series: DraftSeries, gameNumber: number): DraftSeries {
  return mapGame(series, gameNumber, () => emptyGame(gameNumber));
}

/** Reset Series: clears every game (UI must confirm first). */
export function resetSeries(series: DraftSeries): DraftSeries {
  return createSeries(series.format, { globalBanPick: series.globalBanPick, game7Rule: series.game7Rule });
}
