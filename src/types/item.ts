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

export type ArcanaColor = "red" | "purple" | "green";

export interface BuildArcanaEntry {
  name: string;
  reason: string;
  icon?: string;
  description?: string; // stat line from the arcana table (set when the build comes from the DB)
  color?: ArcanaColor; // สีของรูน (แดง/ม่วง/เขียว) ตั้งจากหน้าแอดมิน
  quantity?: number; // จำนวนที่ใส่ เช่น 5, 10
}

export interface HeroBuild {
  heroSlug: string;
  items: BuildItemEntry[];
  arcana: BuildArcanaEntry[];
  patch: string;
  source: "curated" | "heuristic";
}
