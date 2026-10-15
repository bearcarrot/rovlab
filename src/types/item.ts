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

// top_server = บิลด์ Top 10 Server จากในเกม · curated = ทีมงาน RoV LAB เขียนเอง · heuristic = ระบบ RoV LAB ประมวลผล
export type BuildSource = "top_server" | "curated" | "heuristic";

export interface HeroBuild {
  heroSlug: string;
  items: BuildItemEntry[];
  arcana: BuildArcanaEntry[];
  patch: string;
  source: BuildSource;
  serverRank?: number | null; // อันดับ 1–10 ในหน้า Top 10 Server ของเกม (เฉพาะ top_server)
  capturedAt?: string | null; // เวลาที่คัดลอกบิลด์จากเกม (เฉพาะ top_server)
  sourceNote?: string | null;
  id?: string; // item_builds.id (ไม่มีในบิลด์ fallback/mock)
  createdAt?: string; // item_builds.created_at — ตารางนี้ไม่มี updated_at
  spell?: BuildSpell | null;
  enchantments?: BuildEnchantment[];
}
