// One reaction per user per item: none (0) | like (1) | dislike (-1).
export type Reaction = -1 | 0 | 1;

export const toReaction = (v: unknown): Reaction => (v === 1 ? 1 : v === -1 ? -1 : 0);

/** Clicking like/dislike toggles it off when already active, otherwise switches to it. */
export function nextReaction(current: Reaction, clicked: 1 | -1): Reaction {
  return current === clicked ? 0 : clicked;
}

/** Counts after moving one user's reaction from `prev` to `next` (never negative). */
export function applyReaction(
  counts: { likes: number; dislikes: number },
  prev: Reaction,
  next: Reaction
): { likes: number; dislikes: number } {
  return {
    likes: Math.max(0, counts.likes - (prev === 1 ? 1 : 0) + (next === 1 ? 1 : 0)),
    dislikes: Math.max(0, counts.dislikes - (prev === -1 ? 1 : 0) + (next === -1 ? 1 : 0)),
  };
}
