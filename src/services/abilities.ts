import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { parseEffectTags } from "@/lib/effectTags";

// คำอธิบายสกิลของฮีโร่ทั้งหมด (ประมาณ 500 แถว) โหลดครั้งเดียวต่อเซสชัน
// ใช้เป็นข้อมูลอ้างอิงให้ Coach Ai อธิบายการใช้สกิล / คอมโบ / วิธีแก้ทาง โดยไม่ต้องกรอกคู่คอมโบด้วยมือทุกคู่
// และใช้ effectTags (กายภาพ/เวท/ฮีล/สตั๊น ฯลฯ จากเกม) ให้ Draft Assistant ประเมินว่าทีมขาดอะไร

export interface AbilityBrief {
  slot: string;
  name: string;
  description: string;
  // ชื่อแท็กชนิดสกิลจากเกม เช่น "กายภาพ", "ฮีล" (ว่างถ้ายังไม่ได้นำเข้า) — ตัดชื่อสกิลอังกฤษที่หลุดมาแล้ว
  effectTags: string[];
}

export type AbilitiesByHero = Record<string, AbilityBrief[]>; // hero_id → สกิลเรียงตาม sort_order

let cache: Promise<AbilitiesByHero> | null = null;

// PostgREST จำกัดจำนวนแถวต่อคำขอ (ค่าเริ่มต้น 1,000) ถ้าดึงทีเดียวแล้วสกิลเพิ่มจนเกินเพดาน ข้อมูลจะถูกตัดเงียบๆ
// จึงดึงเป็นหน้าๆ (เรียงด้วยคีย์ที่นิ่งพอจะไม่ซ้ำ/ตกหล่นตรงรอยต่อหน้า)
const PAGE = 500;
const MAX_PAGES = 40;

export function getAllAbilities(): Promise<AbilitiesByHero> {
  if (!isSupabaseConfigured) return Promise.resolve({});
  cache ??= (async () => {
    const rows: any[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE;
      const { data, error } = await supabase
        .from("hero_abilities")
        .select("hero_id, slot, name, description, sort_order, effect_tags")
        .order("hero_id")
        .order("sort_order")
        .order("slot")
        .range(from, from + PAGE - 1);
      if (error) {
        cache = null; // ให้ลองโหลดใหม่ได้ครั้งหน้า
        return {};
      }
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < PAGE) break;
    }
    const out: AbilitiesByHero = {};
    for (const r of rows) {
      (out[r.hero_id as string] ??= []).push({
        slot: String(r.slot ?? ""),
        name: (r.name as string | null) ?? "",
        description: (r.description as string | null) ?? "",
        effectTags: parseEffectTags(r.effect_tags).map((t) => t.name),
      });
    }
    return out;
  })();
  return cache;
}
