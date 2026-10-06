import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached, CACHE_TTL_MS } from "@/lib/ttlCache";

// ความสัมพันธ์ระหว่างฮีโร่ที่ Draft Assistant ใช้คำนวณ (ดึงทั้งตารางครั้งเดียว: top-3 ต่อฮีโร่ จึงมีไม่กี่ร้อยแถว)
//  - hero_counters: hero_id = ฮีโร่ที่ "โดนเคาน์เตอร์", counter_hero_id = ฮีโร่ที่ชนะทาง
//  - hero_synergies: hero_id คู่กับ partner_hero_id (ตีความเป็นคอมโบสองทาง)
// reason / lane_tip คือข้อความอธิบายกลไกที่แอดมินกรอกไว้ — ใช้แสดงบนการ์ดและส่งให้ Coach AI อธิบายต่อ

export type CounterStrength = "best" | "good" | "situational";

export interface CounterRel {
  victimId: string;
  counterId: string;
  strength: CounterStrength;
  reason: string;
  laneTip: string;
}

export interface SynergyRel {
  heroId: string;
  partnerId: string;
  reason: string;
}

export interface DraftRelations {
  counters: CounterRel[];
  synergies: SynergyRel[];
}

export const EMPTY_RELATIONS: DraftRelations = { counters: [], synergies: [] };

// ok = false เมื่ออ่านตารางใดตารางหนึ่งไม่ได้ (ไม่เก็บใน cache จะได้ลองใหม่ในครั้งถัดไป)
type Loaded = { rel: DraftRelations; ok: boolean };

async function loadDraftRelations(): Promise<Loaded> {
  const [countersRes, synergiesRes] = await Promise.all([
    supabase.from("hero_counters").select("hero_id, counter_hero_id, strength, reason, lane_tip"),
    supabase.from("hero_synergies").select("hero_id, partner_hero_id, reason"),
  ]);
  // อ่านไม่ได้/ว่าง = ไม่มีข้อมูลความสัมพันธ์ ระบบแนะนำยังทำงานต่อได้ด้วยสถิติ + คอมโพสิชัน
  return {
    ok: !countersRes.error && !synergiesRes.error,
    rel: {
      counters: (countersRes.data ?? []).map((r: any) => ({
        victimId: r.hero_id as string,
        counterId: r.counter_hero_id as string,
        strength: r.strength as CounterStrength,
        reason: ((r.reason as string | null) ?? "").trim(),
        laneTip: ((r.lane_tip as string | null) ?? "").trim(),
      })),
      synergies: (synergiesRes.data ?? []).map((r: any) => ({
        heroId: r.hero_id as string,
        partnerId: r.partner_hero_id as string,
        reason: ((r.reason as string | null) ?? "").trim(),
      })),
    },
  };
}

export async function getDraftRelations(): Promise<DraftRelations> {
  if (!isSupabaseConfigured) return EMPTY_RELATIONS;
  const { rel } = await cached("draft-relations", CACHE_TTL_MS, loadDraftRelations, (v) => v.ok);
  // copies: callers must never be able to mutate the cached arrays
  return { counters: rel.counters.slice(), synergies: rel.synergies.slice() };
}
