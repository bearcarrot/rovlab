import { supabase } from "@/lib/supabase";

export async function getFavoriteHeroSlugs(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("favorites").select("hero_slug").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.hero_slug);
}

export async function addFavorite(userId: string, heroSlug: string) {
  const { error } = await supabase.from("favorites").insert({ user_id: userId, hero_slug: heroSlug });
  if (error) throw error;
}

export async function removeFavorite(userId: string, heroSlug: string) {
  const { error } = await supabase.from("favorites").delete().eq("user_id", userId).eq("hero_slug", heroSlug);
  if (error) throw error;
}
