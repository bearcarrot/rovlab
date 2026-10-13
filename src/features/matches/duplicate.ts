import type { MatchRecord } from "@/types/match";
import type { MatchInsert } from "@/services/matches";

// Exact-duplicate check for a match about to be saved. Pure (no React, no network).
// Compared: result, both team scores, duration, wall-clock time (no time zone exists in the game, so it is compared as
// printed), and per player: team, hero, K/D/A, gold, rating, MVP. Player ROW ORDER is ignored; the row's own values stay together.
// Not compared: other players' nicknames (never stored, by design), item builds (not stored), "which row is me" (a viewpoint, not match data).
// A hero that did not resolve to a known hero (hero_id null) is not a reliable value: it can never make a DUPLICATE.

export type DupStatus = "DUPLICATE" | "NOT_DUPLICATE" | "INDETERMINATE";
export interface DupCheck {
  status: DupStatus;
  /** DUPLICATE / INDETERMINATE: the matching saved match. NOT_DUPLICATE: a saved match with the same time + length but other data (see saveMatch). */
  existing?: MatchRecord;
}

interface P { team: string; heroId: string | null; kills: number; deaths: number; assists: number; gold: number; rating: number; mvp: boolean }
interface Cmp { result: string; scoreBlue: number; scoreRed: number; durationSec: number; playedAt: string; players: P[] }

const wall = (s: string) => String(s).replace("T", " ").slice(0, 19);
const num = (n: unknown) => typeof n === "number" && Number.isFinite(n);

const fromRow = (r: MatchInsert): Cmp => ({
  result: r.result,
  scoreBlue: r.score_blue,
  scoreRed: r.score_red,
  durationSec: r.duration_sec,
  playedAt: r.played_at,
  players: r.players.map((p) => ({ team: p.team, heroId: p.hero_id, kills: p.kills, deaths: p.deaths, assists: p.assists, gold: p.gold, rating: p.rating, mvp: p.mvp })),
});

function key(m: Cmp) {
  const ps = m.players;
  const complete =
    (m.result === "victory" || m.result === "defeat") &&
    [m.scoreBlue, m.scoreRed, m.durationSec].every(num) &&
    /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(wall(m.playedAt)) &&
    ps.length === 10 && ps.filter((p) => p.team === "blue").length === 5 && ps.filter((p) => p.team === "red").length === 5 &&
    ps.every((p) => [p.kills, p.deaths, p.assists, p.gold, p.rating].every(num) && typeof p.mvp === "boolean");
  return {
    complete,
    unresolved: ps.some((p) => !p.heroId),
    head: JSON.stringify([m.result, m.scoreBlue, m.scoreRed, m.durationSec, wall(m.playedAt)]),
    players: ps.map((p) => JSON.stringify([p.team, p.heroId ?? "?", p.kills, p.deaths, p.assists, p.gold, Math.round(p.rating * 10) / 10, p.mvp])).sort().join("|"),
  };
}

/** `sameSlot` = saved matches with the same played_at + duration_sec (the only rows that can be exact duplicates). */
export function checkDuplicate(row: MatchInsert, sameSlot: MatchRecord[]): DupCheck {
  const a = key(fromRow(row));
  if (!a.complete) return { status: "INDETERMINATE" };
  let unsure: MatchRecord | undefined;
  for (const e of sameSlot) {
    const b = key(e);
    if (!b.complete) { unsure ??= e; continue; }
    if (a.head !== b.head || a.players !== b.players) continue;
    if (a.unresolved || b.unresolved) unsure ??= e;
    else return { status: "DUPLICATE", existing: e };
  }
  if (unsure) return { status: "INDETERMINATE", existing: unsure };
  return { status: "NOT_DUPLICATE", existing: sameSlot[0] };
}
