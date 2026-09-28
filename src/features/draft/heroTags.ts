import type { HeroRole } from "@/types/hero";

// Heuristic role -> tag mapping used only because hero data doesn't carry explicit
// damage-type/CC/mobility tags yet. This is an approximation, not measured data —
// the Draft Assistant UI must always label results built from this as heuristic.
export const ROLE_TAGS: Record<
  HeroRole,
  { damage: "physical" | "magic"; frontline: number; cc: number; mobility: number; sustain: number; scaling: "early" | "flat" | "late" }
> = {
  tank: { damage: "physical", frontline: 3, cc: 2, mobility: 1, sustain: 2, scaling: "flat" },
  fighter: { damage: "physical", frontline: 2, cc: 1, mobility: 2, sustain: 1, scaling: "flat" },
  assassin: { damage: "physical", frontline: 0, cc: 0, mobility: 3, sustain: 0, scaling: "early" },
  mage: { damage: "magic", frontline: 0, cc: 2, mobility: 1, sustain: 0, scaling: "late" },
  marksman: { damage: "physical", frontline: 0, cc: 0, mobility: 1, sustain: 0, scaling: "late" },
  support: { damage: "magic", frontline: 1, cc: 3, mobility: 1, sustain: 3, scaling: "flat" },
};
