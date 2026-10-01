import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ความสัมพันธ์ระหว่างฮีโร่ที่ Draft Assistant ใช้คำนวณ (ดึงทั้งตารางครั้งเดียว: top-3 ต่อฮีโร่ จึงมีไม่กี่ร้อยแถว)
//  - hero_counters: hero_id = ฮีโร่ที่ "โดนเคาน์เตอร์", counter_hero_id = ฮีโร่ที่ชนะทาง
//  - hero_synergies: hero_id คู่กับ partner_hero_id (ตีความเป็นคอมโบสองทาง)

export type CounterStrength = "best" | "good" | "situational";

export interface CounterRel {
  victimId: string;
  counterId: string;
  strength: CounterStrength;
}

export interface SynergyRel {
  heroId: string;
  partnerId: string;
}

export interface DraftRelations {
  counters: CounterRel[];
  synergies: SynergyRel[];
}

export const EMPTY_RELATIONS: DraftRelations = { counters: [], synergies: [] };

export async function getDraftRelations(): Promise<DraftRelations> {
  if (!isSupabaseConfigured) return EMPTY_RELATIONS;
  const [countersRes, synergiesRes] = await Promise.all([
    supabase.from("hero_counters").select("hero_id, counter_hero_id, strength"),
    supabase.from("hero_synergies").select("hero_id, partner_hero_id"),
  ]);
  // อ่านไม่ได้/ว่าง = ไม่มีข้อมูลความสัมพันธ์ ระบบแนะนำยังทำงานต่อได้ด้วยสถิติ + คอมโพสิชัน
  return {
    counters: (countersRes.data ?? []).map((r: any) => ({
      victimId: r.hero_id as string,
      counterId: r.counter_hero_id as string,
      strength: r.strength as CounterStrength,
    })),
    synergies: (synergiesRes.data ?? []).map((r: any) => ({
      heroId: r.hero_id as string,
      partnerId: r.partner_hero_id as string,
    })),
  };
}
