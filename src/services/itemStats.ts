import { supabase } from "@/lib/supabase";
import { parseHeroItemStats, type HeroItemUsage } from "@/features/build/itemUsage";

// Community item usage for one hero: aggregates only, from users' opt-in 6-slot builds (RPC hero_item_stats, signed-in users).
// The error message is safe to show; the raw database error goes to the console.
export async function getHeroItemUsage(heroId: string): Promise<HeroItemUsage> {
  const { data, error } = await supabase.rpc("hero_item_stats", { p_hero: heroId });
  if (error) {
    console.error("getHeroItemUsage", error);
    throw new Error("โหลดสถิติไอเทมไม่สำเร็จ");
  }
  return parseHeroItemStats(data);
}
