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

export interface BuildItemEntry {
  itemSlug: string;
  reason: string;
  phase: "early" | "core" | "situational";
}

export interface BuildArcanaEntry {
  name: string;
  /** คำอธิบายหรือค่าสเตตัสของรูน (จาก arcana.description) */
  reason: string;
  icon?: string;
}

export interface HeroBuild {
  heroSlug: string;
  items: BuildItemEntry[];
  arcana: BuildArcanaEntry[];
  patch: string;
  source: "curated" | "heuristic";
}
