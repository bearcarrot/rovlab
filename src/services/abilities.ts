import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// คำอธิบายสกิลของฮีโร่ทั้งหมด (ประมาณ 500 แถว) โหลดครั้งเดียวต่อเซสชัน
// ใช้เป็นข้อมูลอ้างอิงให้ Coach AI อธิบายการใช้สกิล / คอมโบ / วิธีแก้ทาง โดยไม่ต้องกรอกคู่คอมโบด้วยมือทุกคู่
// และใช้ effectTags (ฮีล/โล่/บัฟ ฯลฯ จากเกม) ให้ Draft Assistant ประเมินว่าทีมขาดอะไร

export interface AbilityBrief {
  slot: string;
  name: string;
  description: string;
  // ชื่อแท็กชนิดสกิลจากเกม เช่น "ฮีล", "บัฟ" (ว่างถ้ายังไม่ได้นำเข้า)
  effectTags: string[];
}

export type AbilitiesByHero = Record<string, AbilityBrief[]>; // hero_id → สกิลเรียงตาม sort_order

let cache: Promise<AbilitiesByHero> | null = null;

// effect_tags เป็น jsonb [{ "type": 8, "name": "ฮีล" }] — อ่านเฉพาะชื่อ และทนต่อข้อมูลผิดรูปแบบ
function tagNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => (t && typeof t === "object" ? String((t as { name?: unknown }).name ?? "").trim() : ""))
    .filter(Boolean);
}

export function getAllAbilities(): Promise<AbilitiesByHero> {
  if (!isSupabaseConfigured) return Promise.resolve({});
  cache ??= (async () => {
    const { data, error } = await supabase
      .from("hero_abilities")
      .select("hero_id, slot, name, description, sort_order, effect_tags")
      .order("sort_order");
    if (error) {
      cache = null; // ให้ลองโหลดใหม่ได้ครั้งหน้า
      return {};
    }
    const out: AbilitiesByHero = {};
    for (const r of (data ?? []) as any[]) {
      (out[r.hero_id as string] ??= []).push({
        slot: String(r.slot ?? ""),
        name: (r.name as string | null) ?? "",
        description: (r.description as string | null) ?? "",
        effectTags: tagNames(r.effect_tags),
      });
    }
    return out;
  })();
  return cache;
}
