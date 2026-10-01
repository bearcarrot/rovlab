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

export type ArcanaColor = "red" | "purple" | "green";

export interface BuildArcanaEntry {
  name: string;
  color: ArcanaColor;
  /** จำนวนช่องที่ใส่รูนนี้ (1–10 ต่อสี) */
  quantity: number;
  /** สเตตัสต่อ 1 ช่อง เช่น "พลังโจมตี +2 · เจาะเกราะ +3.6" (arcana.description) */
  stats: string;
  /** หมายเหตุเหตุผลที่เลือกรูนนี้ (item_build_arcana.reason) */
  reason?: string;
  icon?: string;
}

export interface HeroBuild {
  heroSlug: string;
  items: BuildItemEntry[];
  arcana: BuildArcanaEntry[];
  patch: string;
  source: "curated" | "heuristic";
}
