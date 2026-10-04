// แท็กชนิดสกิลจากเกม (hero_abilities.effect_tags = jsonb [{ "type": 1, "name": "กายภาพ" }])
// ที่นี่เป็นที่เดียวที่รู้ว่าแท็กไหนอยู่กลุ่มไหน / สีเริ่มต้นอะไร — หน้าฮีโร่ Draft Assist และหน้าแอดมินใช้ร่วมกัน
// สีที่แอดมินตั้งไว้เก็บในตาราง effect_tag_styles (ทับสีเริ่มต้นเป็นรายชื่อแท็ก)

export interface EffectTag {
  type: number;
  name: string;
}

export type EffectGroup =
  | "physical"
  | "magic"
  | "true"
  | "mixed"
  | "aoe"
  | "cc"
  | "slow"
  | "mobility"
  | "heal"
  | "defense"
  | "buff"
  | "other";

// ลำดับการแสดงผล: ชนิดดาเมจก่อน → คุมฝูงชน → เคลื่อนที่ → ซัพพอร์ต → อื่นๆ
export const GROUP_ORDER: EffectGroup[] = [
  "physical", "magic", "true", "mixed", "aoe", "cc", "slow", "mobility", "heal", "defense", "buff", "other",
];

const GROUP_BY_NAME: Record<string, EffectGroup> = {
  กายภาพ: "physical",
  เวท: "magic",
  จริง: "true",
  ความเสียหายผสม: "mixed",
  ความเสียหายหมู่: "aoe",
  // คุมฝูงชน
  สตั๊น: "cc", ลอยขึ้น: "cc", ผลักถอยหลัง: "cc", ควบคุม: "cc", ใบ้: "cc", ล็อคตัว: "cc",
  แช่แข็ง: "cc", ยั่วยุ: "cc", จำกัด: "cc", ดูดกลืน: "cc", หยุดนิ่ง: "cc", Fossilize: "cc",
  ลดความเร็ว: "slow",
  เคลื่อนที่: "mobility", เพิ่มความเร็ว: "mobility", วาร์ป: "mobility",
  ฮีล: "heal", คืนชีพ: "heal",
  // "ป้องกัน" (type 5) ในเกมคือสกิลที่ให้โล่ — ตรวจจากคำอธิบายสกิลแล้ว (Chrono Shield, Aquatic Shield ฯลฯ)
  ป้องกัน: "defense", ลดความเสียหาย: "defense", ต้านความเสียหาย: "defense", ต้านสถานะ: "defense",
  ป้องกันตาย: "defense", ไม่ตกเป็นเป้าหมาย: "defense", กันกายภาพ: "defense", ล้างสถานะ: "defense",
  บัฟ: "buff", เพิ่มความเสียหาย: "buff", เพิ่มความเร็วโจมตี: "buff",
};

// สีเริ่มต้นตามกลุ่ม (hex) — กายภาพ แดง · เวท น้ำเงิน · จริง เทา · CC เหลือง ฯลฯ
export const GROUP_COLOR: Record<EffectGroup, string> = {
  physical: "#ef4444",
  magic: "#3b82f6",
  true: "#94a3b8",
  mixed: "#a855f7",
  aoe: "#f97316",
  cc: "#eab308",
  slow: "#06b6d4",
  mobility: "#10b981",
  heal: "#22c55e",
  defense: "#14b8a6",
  buff: "#ec4899",
  other: "#94a3b8",
};

// ชุดสีให้แอดมินแตะเลือก (นอกจากนี้เลือกเองได้จากตัวเลือกสี)
export const EFFECT_COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: "แดง", hex: "#ef4444" },
  { label: "ส้ม", hex: "#f97316" },
  { label: "เหลือง", hex: "#eab308" },
  { label: "เขียว", hex: "#22c55e" },
  { label: "เขียวมรกต", hex: "#10b981" },
  { label: "เขียวน้ำทะเล", hex: "#14b8a6" },
  { label: "ฟ้า", hex: "#06b6d4" },
  { label: "น้ำเงิน", hex: "#3b82f6" },
  { label: "ม่วง", hex: "#a855f7" },
  { label: "ชมพู", hex: "#ec4899" },
  { label: "เทา", hex: "#94a3b8" },
  { label: "ขาว", hex: "#e2e8f0" },
];

const HAS_THAI = /[\u0E00-\u0E7F]/;
const HEX6 = /^#[0-9a-f]{6}$/i;
const HEX3 = /^#[0-9a-f]{3}$/i;

// รับ #RGB / #RRGGBB คืน #rrggbb (ตัวพิมพ์เล็ก) · ไม่ถูกต้อง = null
export function safeHex(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (HEX6.test(s)) return s.toLowerCase();
  if (HEX3.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return null;
}

export function tagGroup(name: string): EffectGroup {
  return GROUP_BY_NAME[name] ?? "other";
}

// overrides = สีที่แอดมินตั้งไว้ (name → hex) ถ้าไม่มีหรือรหัสสีเสีย ใช้สีเริ่มต้นตามกลุ่ม
export function tagColor(name: string, overrides?: Record<string, string>): string {
  return safeHex(overrides?.[name]) ?? GROUP_COLOR[tagGroup(name)];
}

// อ่านชื่อแท็กจากค่าได้ทั้ง jsonb [{type,name}] / อาร์เรย์ชื่อ / ข้อความคั่นด้วย ,
export function tagNames(v: unknown): string[] {
  const raw: unknown[] = Array.isArray(v) ? v : String(v ?? "").split(",");
  const out: string[] = [];
  for (const t of raw) {
    const name = (t && typeof t === "object" ? String((t as { name?: unknown }).name ?? "") : String(t ?? "")).trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

// อ่าน jsonb ทนข้อมูลผิดรูปแบบ: ตัดชื่อซ้ำ (เช่น ต้านสถานะ มี 2 type)
// และตัดชื่อสกิลภาษาอังกฤษที่หลุดเข้ามาในคอลัมน์ (type 1 เช่น "Chrono Shield", "Don’t Test Me") — ไม่ใช่แท็กจริง
// เกณฑ์: ชื่อที่ไม่อยู่ในรายการที่รู้จักและไม่มีตัวอักษรไทยเลย = ทิ้ง
export function parseEffectTags(raw: unknown): EffectTag[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EffectTag[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const name = String((t as { name?: unknown }).name ?? "").trim();
    if (!name || seen.has(name)) continue;
    if (!(name in GROUP_BY_NAME) && !HAS_THAI.test(name)) continue;
    seen.add(name);
    out.push({ type: Number((t as { type?: unknown }).type) || 0, name });
  }
  return out;
}

// รวมแท็กของทุกสกิลเป็นชุดเดียว (ไม่ซ้ำ) เรียงตามกลุ่ม
export function summarizeTags(lists: (EffectTag[] | undefined)[]): EffectTag[] {
  const seen = new Map<string, EffectTag>();
  for (const l of lists) for (const t of l ?? []) if (!seen.has(t.name)) seen.set(t.name, t);
  return sortTags([...seen.values()]);
}

export function sortTags(tags: EffectTag[]): EffectTag[] {
  return [...tags].sort((a, b) => GROUP_ORDER.indexOf(tagGroup(a.name)) - GROUP_ORDER.indexOf(tagGroup(b.name)));
}
