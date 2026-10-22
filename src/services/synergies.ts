import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached } from "@/lib/ttlCache";
import type { HeroSummary } from "@/types/hero";

// คอมโบ/ซินเนอร์จี้ทั้งหมดจาก hero_synergies (ตารางเล็ก ~สิบกว่าถึงหลักร้อยแถว จึงดึงทีเดียวแล้วกรองฝั่ง client)
// ชื่อที่แสดงใช้ชื่ออังกฤษ (nameTh = name) เหมือน services/heroes.ts
export type SynergyHero = Pick<HeroSummary, "slug" | "name" | "nameTh" | "thaiName" | "icon">;
export type SynergyPair = { id: string; hero: SynergyHero; partner: SynergyHero; reason: string };

const HERO_COLS = "slug, name, name_th, icon_url";

function toHero(r: any): SynergyHero | null {
  if (!r?.slug) return null;
  return { slug: r.slug, name: r.name, nameTh: r.name, thaiName: r.name_th || undefined, icon: r.icon_url ?? "" };
}

async function loadSynergies(): Promise<SynergyPair[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hero_synergies")
    .select(
      `id, reason, hero:heroes!hero_synergies_hero_id_fkey(${HERO_COLS}), partner:heroes!hero_synergies_partner_hero_id_fkey(${HERO_COLS})`,
    );
  // อย่ากลืน error: ไม่งั้นหน้าจะขึ้น "ยังไม่มีข้อมูล" ทั้งที่จริงโหลดไม่สำเร็จ
  if (error) throw new Error(error.message);
  const pairs: SynergyPair[] = [];
  for (const r of (data ?? []) as any[]) {
    const hero = toHero(r.hero);
    const partner = toHero(r.partner);
    if (hero && partner) pairs.push({ id: r.id, hero, partner, reason: r.reason ?? "" });
  }
  return pairs.sort((a, b) => a.hero.name.localeCompare(b.hero.name) || a.partner.name.localeCompare(b.partner.name));
}

export function getAllSynergies(): Promise<SynergyPair[]> {
  return cached("synergies:all", 5 * 60 * 1000, loadSynergies).then((list) => list.slice());
}
