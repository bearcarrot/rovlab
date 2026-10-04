import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/profile";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    handle: data.handle ?? "",
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    preferredRoles: data.preferred_roles ?? [],
    preferredHeroes: [], // preferred_heroes is stored as hero UUIDs server-side; resolved separately once heroes are seeded
  };
}

export async function updateDisplayName(userId: string, displayName: string) {
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
  if (error) throw error;
}

export async function updatePreferredRoles(userId: string, roles: string[]) {
  const { error } = await supabase.from("profiles").update({ preferred_roles: roles }).eq("id", userId);
  if (error) throw error;
}

export async function updateHandle(userId: string, handle: string) {
  const { error } = await supabase.from("profiles").update({ handle }).eq("id", userId);
  if (error) throw error;
}
