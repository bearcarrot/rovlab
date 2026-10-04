import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { safeHex } from "@/lib/effectTags";

// สีป้ายแท็กสกิลที่แอดมินตั้งไว้ (ตาราง effect_tag_styles: name → hex) โหลดครั้งเดียวต่อเซสชัน
// ตารางยังไม่มี / โหลดไม่ได้ = คืน {} แล้วป้ายใช้สีเริ่มต้นตามกลุ่ม (ไม่ให้หน้าพัง)
const db: any = supabase; // ตารางนี้ยังไม่อยู่ใน types ที่ generate ไว้

let cache: Promise<Record<string, string>> | null = null;

export function getEffectTagColors(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return Promise.resolve({});
  cache ??= (async () => {
    const { data, error } = await db.from("effect_tag_styles").select("name, color");
    if (error || !data) {
      cache = null; // ให้ลองใหม่ครั้งหน้า
      return {};
    }
    const out: Record<string, string> = {};
    for (const r of data as { name: string; color: string }[]) {
      const hex = safeHex(r.color);
      if (r.name && hex) out[r.name] = hex;
    }
    return out;
  })();
  return cache;
}

// แอดมินแก้สีแล้วล้างแคช เพื่อให้หน้าถัดไปโหลดสีใหม่ (เหมือน clearFilterIconsCache)
export function clearEffectTagStylesCache() {
  cache = null;
}
