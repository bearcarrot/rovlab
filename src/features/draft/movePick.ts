import type { DraftSeries, TeamKey } from "./series";

/**
 * Swap two pick slots of one team in one game (or move a hero into an empty slot).
 * Pure + immutable. Same-team only: analysis does not depend on slot order, and Global BP stays per team.
 * Returns the same `series` object when nothing changes, so `commit` can skip history.
 */
export function movePick(
  series: DraftSeries,
  gameNumber: number,
  team: TeamKey,
  from: number,
  to: number
): DraftSeries {
  if (from === to) return series;
  const game = series.games.find((g) => g.gameNumber === gameNumber);
  if (!game) return series;
  const picks = game[team].picks;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return series;
  if (from < 0 || to < 0 || from >= picks.length || to >= picks.length) return series;
  if (picks[from] === null && picks[to] === null) return series;
  const next = [...picks];
  next[from] = picks[to];
  next[to] = picks[from];
  return {
    ...series,
    games: series.games.map((g) =>
      g.gameNumber === gameNumber ? { ...g, [team]: { ...g[team], picks: next } } : g
    ),
  };
}
