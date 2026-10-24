// Competitive Ban/Pick sequence + countdown math. Pure functions, no React/Supabase.
//
// The current turn is DERIVED from how many bans/picks each team already has in the open game,
// so there is no extra state to keep in sync: undo, clearing a slot, switching game and "new draft" all just work.
import type { DraftGame, TeamKey } from "./series";

export type Side = "first" | "second";
export type TurnKind = "ban" | "pick";
export type Turn = { phase: 1 | 2 | 3 | 4; kind: TurnKind; side: Side; count: number };

// Authoritative order (Ban 1 -> Pick 1 -> Ban 2 -> Pick 2). Do not reorder.
export const TURNS: readonly Turn[] = [
  { phase: 1, kind: "ban", side: "first", count: 1 },
  { phase: 1, kind: "ban", side: "second", count: 1 },
  { phase: 1, kind: "ban", side: "first", count: 1 },
  { phase: 1, kind: "ban", side: "second", count: 1 },
  { phase: 2, kind: "pick", side: "first", count: 1 },
  { phase: 2, kind: "pick", side: "second", count: 2 },
  { phase: 2, kind: "pick", side: "first", count: 2 },
  { phase: 2, kind: "pick", side: "second", count: 1 },
  { phase: 3, kind: "ban", side: "first", count: 1 },
  { phase: 3, kind: "ban", side: "second", count: 1 },
  { phase: 3, kind: "ban", side: "first", count: 1 },
  { phase: 3, kind: "ban", side: "second", count: 1 },
  { phase: 4, kind: "pick", side: "second", count: 1 },
  { phase: 4, kind: "pick", side: "first", count: 2 },
  { phase: 4, kind: "pick", side: "second", count: 1 },
];

export const BAN_SECONDS = 30;
export const PICK_SECONDS = 25;
export const turnSeconds = (kind: TurnKind) => (kind === "ban" ? BAN_SECONDS : PICK_SECONDS);

export type CurrentTurn = Turn & {
  /** Index into TURNS: changes exactly when the active turn changes (use as the timer key). */
  index: number;
  team: TeamKey;
  /** Heroes still required in this turn (1 or 2). */
  left: number;
};

const other = (t: TeamKey): TeamKey => (t === "mine" ? "enemy" : "mine");
export const teamOf = (side: Side, firstPick: TeamKey): TeamKey => (side === "first" ? firstPick : other(firstPick));

/**
 * The turn a team must act in now, or null when the draft is complete.
 * Walks TURNS handing out each team's existing bans/picks in order; the first turn not fully covered is current.
 */
export function getCurrentTurn(game: DraftGame, firstPick: TeamKey): CurrentTurn | null {
  const left = {
    ban: { mine: game.mine.bans.length, enemy: game.enemy.bans.length },
    pick: {
      mine: game.mine.picks.filter(Boolean).length,
      enemy: game.enemy.picks.filter(Boolean).length,
    },
  };
  for (let index = 0; index < TURNS.length; index++) {
    const t = TURNS[index];
    const team = teamOf(t.side, firstPick);
    const done = Math.min(t.count, left[t.kind][team]);
    left[t.kind][team] -= done;
    if (done < t.count) return { ...t, index, team, left: t.count - done };
  }
  return null;
}

/** Where the picker should point for a turn: first empty slot for picks, "ban" for bans. */
export function turnTarget(game: DraftGame, turn: CurrentTurn): { team: TeamKey; kind: "ban" } | { team: TeamKey; kind: "pick"; index: number } {
  if (turn.kind === "ban") return { team: turn.team, kind: "ban" };
  return { team: turn.team, kind: "pick", index: Math.max(0, game[turn.team].picks.findIndex((p) => p === null)) };
}

/** Is a ban/pick by `team` allowed right now? (Duplicate/banned heroes are already filtered out of the picker pool.) */
export const isTurnAllowed = (turn: CurrentTurn | null, team: TeamKey, kind: TurnKind) =>
  !!turn && turn.team === team && turn.kind === kind;

// ---------- countdown ----------

/** Wall-clock deadline, so a throttled/background tab still shows the right time when it resumes. */
export const makeDeadline = (kind: TurnKind, now: number) => now + turnSeconds(kind) * 1000;

/** Whole seconds left (rounded up), never below 0. */
export const secondsLeft = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));
