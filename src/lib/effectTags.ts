// แท็กชนิดสกิลจากเกม (hero_abilities.effect_tags = jsonb [{ "type": 1, "name": "กายภาพ" }])
// ที่นี่เป็นที่เดียวที่รู้ว่าแท็กไหนอยู่กลุ่มไหน / สีอะไร — หน้าฮีโร่และ Draft Assist ใช้ร่วมกัน

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
  แช่แข็ง: "cc", ยั่วยุ: "cc", จำกัด: "cc", ดูดกลืน: "cc", Fossilize: "cc",
  ลดความเร็ว: "slow",
  เคลื่อนที่: "mobility", เพิ่มความเร็ว: "mobility", วาร์ป: "mobility",
  ฮีล: "heal", คืนชีพ: "heal",
  // "ป้องกัน" (type 5) ในเกมคือสกิลที่ให้โล่ — ตรวจจากคำอธิบายสกิลแล้ว (Chrono Shield, Aquatic Shield ฯลฯ)
  ป้องกัน: "defense", ลดความเสียหาย: "defense", ต้านความเสียหาย: "defense", ต้านสถานะ: "defense",
  ป้องกันตาย: "defense", ไม่ตกเป็นเป้าหมาย: "defense", กันกายภาพ: "defense", ล้างสถานะ: "defense",
  บัฟ: "buff", เพิ่มความเสียหาย: "buff", เพิ่มความเร็วโจมตี: "buff",
};

// ชื่อแท็กที่เป็นภาษาอังกฤษล้วน = ชื่อสกิลที่หลุดเข้ามาในคอลัมน์ (type 1 เช่น "Chrono Shield") ไม่ใช่แท็กจริง → ทิ้ง
const ASCII_ONLY = /^[\x00-\x7F]+$/;

export function tagGroup(name: string): EffectGroup {
  return GROUP_BY_NAME[name] ?? "other";
}

// อ่าน jsonb ทนข้อมูลผิดรูปแบบ: ตัดชื่อซ้ำ (เช่น ต้านสถานะ มี 2 type) + ตัดชื่อสกิลภาษาอังกฤษที่หลุดมา
export function parseEffectTags(raw: unknown): EffectTag[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EffectTag[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const name = String((t as { name?: unknown }).name ?? "").trim();
    if (!name || seen.has(name)) continue;
    if (!(name in GROUP_BY_NAME) && ASCII_ONLY.test(name)) continue;
    seen.add(name);
    out.push({ type: Number((t as { type?: unknown }).type) || 0, name });
  }
  return out;
}

// รวมแท็กของทุกสกิลเป็นชุดเดียว (ไม่ซ้ำ) เรียงตามกลุ่ม สำหรับสรุปบนหัวหน้าฮีโร่
export function summarizeTags(lists: (EffectTag[] | undefined)[]): EffectTag[] {
  const seen = new Map<string, EffectTag>();
  for (const l of lists) for (const t of l ?? []) if (!seen.has(t.name)) seen.set(t.name, t);
  return sortTags([...seen.values()]);
}

export function sortTags(tags: EffectTag[]): EffectTag[] {
  return [...tags].sort((a, b) => GROUP_ORDER.indexOf(tagGroup(a.name)) - GROUP_ORDER.indexOf(tagGroup(b.name)));
}

// ชื่อคลาสเขียนเต็มเพื่อให้ Tailwind สแกนเจอ — กายภาพ แดง · เวท น้ำเงิน · จริง ขาว/เทา · CC เหลือง ฯลฯ
export const GROUP_STYLE: Record<EffectGroup, string> = {
  physical: "bg-red-500/15 text-red-500 border-red-500/40",
  magic: "bg-blue-500/15 text-blue-500 border-blue-500/40",
  true: "bg-slate-400/20 text-slate-400 border-slate-400/40",
  mixed: "bg-purple-500/15 text-purple-500 border-purple-500/40",
  aoe: "bg-orange-500/15 text-orange-500 border-orange-500/40",
  cc: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40",
  slow: "bg-cyan-500/15 text-cyan-500 border-cyan-500/40",
  mobility: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  heal: "bg-green-500/15 text-green-500 border-green-500/40",
  defense: "bg-teal-500/15 text-teal-500 border-teal-500/40",
  buff: "bg-pink-500/15 text-pink-500 border-pink-500/40",
  other: "bg-bg-raised text-text-muted border-border",
};
