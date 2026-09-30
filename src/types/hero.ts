export type HeroRole = "assassin" | "fighter" | "mage" | "marksman" | "support" | "tank";
export type HeroLane = "slayer" | "jungle" | "mid" | "abyssal" | "support";
export type HeroDifficulty = "easy" | "medium" | "hard";
export type Tier = "S+" | "S" | "A" | "B" | "C";

export interface HeroStatSnapshot {
  patch: string;
  rankTier: string;
  winRate: number;
  pickRate: number;
  banRate: number;
  tier: Tier;
  matches: number;
  // false when no hero_stats row exists yet for this hero (e.g. before Admin
  // panel seeds it) — UI must show "N/A" instead of treating 0 as a real stat.
  hasStats: boolean;
}

export interface HeroSummary {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  role: HeroRole;
  lane: HeroLane;
  difficulty: HeroDifficulty;
  icon: string;
  stat: HeroStatSnapshot;
}

export interface HeroAbility {
  slot: string;
  name: string;
  description: string;
  icon?: string; // icon_url from hero_abilities (set via /admin)
}

export interface CounterEntry {
  heroSlug: string;
  heroNameTh?: string; // resolved directly when sourced from Supabase; falls back to MOCK_HEROES lookup otherwise
  heroIcon?: string; // icon_url of that hero when sourced from Supabase
  strength: "best" | "good" | "situational";
  reason: string;
  laneTip: string;
}

export interface SynergyEntry {
  heroSlug: string;
  heroNameTh?: string;
  heroIcon?: string;
  reason: string;
}

export interface HeroDetail extends HeroSummary {
  description: string;
  strengths: string[];
  weaknesses: string[];
  abilities: HeroAbility[];
  counteredBy: CounterEntry[];
  countersAgainst: CounterEntry[];
  synergies: SynergyEntry[];
}
