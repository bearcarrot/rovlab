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

// สกิลชาเลนเจอร์ของบิลด์ — คืนเฉพาะแถวที่ status active/seasonal และยืนยันกับเกมแล้ว
export interface BuildSpell {
  slug: string;
  name: string;
  nameTh: string;
  description: string;
  cooldownSeconds: number | null;
  status: string;
  icon?: string;
}

// พลังแฝงของบิลด์ (selection_type primary/secondary จาก item_build_enchantments)
export interface BuildEnchantment {
  slug: string;
  name: string;
  nameTh: string;
  description: string;
  tier: number | null;
  category: string;
  status: string;
  icon?: string;
  type: "primary" | "secondary";
}

export interface HeroBuild {
  heroSlug: string;
  items: BuildItemEntry[];
  arcana: BuildArcanaEntry[];
  patch: string;
  source: "curated" | "heuristic";
  spell?: BuildSpell | null;
  enchantments?: BuildEnchantment[];
}
