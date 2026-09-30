export interface ItemSummary {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  cost: number;
  stats: string[]; // short stat lines, e.g. "+65 พลังโจมตี"
  passive: string;
  icon: string;
}

// Row of the `arcana` table (rune/arcana with its real in-game icon).
export interface ArcanaSummary {
  id: string;
  name: string;
  description: string; // short stat line, e.g. "พลังเวท +5.3"
  icon: string;
}

export interface BuildItemEntry {
  itemSlug: string;
  reason: string;
  phase: "early" | "core" | "situational";
}

export interface HeroBuild {
  heroSlug: string;
  items: BuildItemEntry[];
  arcana: { name: string; reason: string }[];
  patch: string;
  source: "curated" | "heuristic";
}
