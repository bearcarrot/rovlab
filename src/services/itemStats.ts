import { supabase } from "@/lib/supabase";
import { parseHeroItemUsage, type HeroItemUsageSet } from "@/features/build/itemUsage";

// Community item usage for one hero: aggregates only, from users' opt-in verified items (RPC hero_item_usage, signed-in users).
// One call returns both scopes (item-level and complete-build). The error message is safe to show; the raw database error goes to the console.
export async function getHeroItemUsage(heroId: string): Promise<HeroItemUsageSet> {
  const { data, error } = await supabase.rpc("hero_item_usage", { p_hero: heroId });
  if (error) {
    console.error("getHeroItemUsage", error);
    throw new Error("โหลดสถิติไอเทมไม่สำเร็จ");
  }
  return parseHeroItemUsage(data);
}
