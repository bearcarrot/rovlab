import { CONFIDENT_MARGIN, type SlotGuess } from "@/features/matches/itemMatch";

// Where each saved item slot came from. Only verified sources count in the community item statistics; the database
// re-checks this (migration 20261020b_item_level_observations.sql), so keep the margin rule in sync with CONFIDENT_MARGIN.

export type ItemSrc = "ocr_confident" | "ocr_unsure" | "user_selected" | "user_corrected" | "user_confirmed" | "none";

/** A catalogue item whose best icon match is clearly ahead of the second best (the same test the review screen highlights with). */
export const isConfident = (g: SlotGuess | null | undefined) => !!g && g.slug !== null && g.margin >= CONFIDENT_MARGIN;

export const isVerified = (s: ItemSrc) =>
  s === "ocr_confident" || s === "user_selected" || s === "user_corrected" || s === "user_confirmed";

/**
 * touched = the user picked something in this slot's list (picking the guessed item again is an explicit confirmation).
 * An untouched guess is verified only when it is confident; an untouched unsure guess is not.
 */
export function slotSource(slug: string | null, guess: SlotGuess | null | undefined, touched: boolean): ItemSrc {
  if (slug === null) return "none";
  if (!touched) {
    if (guess && guess.slug === slug) return isConfident(guess) ? "ocr_confident" : "ocr_unsure";
    return "user_selected";
  }
  if (guess?.slug === slug) return "user_confirmed";
  return guess?.slug ? "user_corrected" : "user_selected";
}

/** margin is the OCR guess's score (null when there is none or the slot was flat/empty, whose margin is Infinity). */
export function itemProvenance(slots: (string | null)[], guesses: SlotGuess[] | null, touched: boolean[]) {
  const src = slots.map((s, i) => slotSource(s, guesses?.[i], touched[i] ?? false));
  const margin = slots.map((_, i) => {
    const m = guesses?.[i]?.margin;
    return typeof m === "number" && Number.isFinite(m) ? Math.round(m * 1e4) / 1e4 : null;
  });
  return { src, margin, verified: src.filter(isVerified).length };
}
