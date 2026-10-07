import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { functionErrorMessage } from "@/lib/functionError";
import { setMyAvatar } from "@/lib/myAvatarStore";
import { getContactApp, parseContactLinks, validateContactUrl } from "@/features/profile/contactApps";
import { PROFILE_LIMITS } from "@/types/profile";
import type { ContactLink, Profile, PublicProfile } from "@/types/profile";

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferred_roles: string[] | null;
  preferred_heroes: string[] | null;
  bio: string | null;
  game_name: string | null;
  contact?: string | null;
  contact_links?: unknown;
  created_at?: string;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    preferredRoles: row.preferred_roles ?? [],
    preferredHeroes: row.preferred_heroes ?? [],
    bio: row.bio,
    gameName: row.game_name,
    contact: row.contact ?? null,
    contactLinks: parseContactLinks(row.contact_links),
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  if (!data) return null;
  return toProfile(data as ProfileRow);
}

export async function updateDisplayName(userId: string, displayName: string) {
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
  if (error) throw error;
}

export async function updatePreferredRoles(userId: string, roles: string[]) {
  const { error } = await supabase.from("profiles").update({ preferred_roles: roles }).eq("id", userId);
  if (error) throw error;
}

export interface ProfileEdit {
  displayName: string;
  bio: string;
  gameName: string;
  contactLinks: ContactLink[];
  preferredRoles: string[];
  preferredHeroes: string[]; // hero ids
}

// avatar_url is intentionally not editable here: it can only be changed through the moderated `avatar` Edge Function.
export async function updateProfile(userId: string, edit: ProfileEdit): Promise<void> {
  const displayName = edit.displayName.trim();
  if (displayName.length < PROFILE_LIMITS.displayNameMin || displayName.length > PROFILE_LIMITS.displayNameMax) {
    throw new Error(`ชื่อที่แสดงต้องยาว ${PROFILE_LIMITS.displayNameMin}–${PROFILE_LIMITS.displayNameMax} ตัวอักษร`);
  }
  if (edit.bio.trim().length > PROFILE_LIMITS.bio) throw new Error(`แนะนำตัวได้ไม่เกิน ${PROFILE_LIMITS.bio} ตัวอักษร`);
  if (edit.gameName.trim().length > PROFILE_LIMITS.gameName) throw new Error(`ชื่อในเกมได้ไม่เกิน ${PROFILE_LIMITS.gameName} ตัวอักษร`);
  const heroes = Array.from(new Set(edit.preferredHeroes));
  if (heroes.length > PROFILE_LIMITS.favoriteHeroes) throw new Error(`เลือกฮีโร่ที่ถนัดได้สูงสุด ${PROFILE_LIMITS.favoriteHeroes} ตัว`);

  // Official-URL check again before saving (the database CHECK is the final gate).
  const seen = new Set<string>();
  const links: ContactLink[] = [];
  for (const l of edit.contactLinks) {
    const r = validateContactUrl(l.app, l.url);
    if (!r.ok) throw new Error(`${getContactApp(l.app).label}: ${r.error}`);
    if (seen.has(l.app)) throw new Error("เพิ่มแอปเดียวกันซ้ำไม่ได้");
    seen.add(l.app);
    links.push({ app: l.app, url: r.url });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: edit.bio.trim() || null,
      game_name: edit.gameName.trim() || null,
      contact_links: links,
      preferred_roles: edit.preferredRoles,
      preferred_heroes: heroes,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

// Uploads a (client-resized) JPEG as base64. The Edge Function moderates it before storing; rejected images throw.
export async function uploadAvatar(base64: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("avatar", { body: { action: "upload", image: base64 } });
  if (error) throw new Error(await functionErrorMessage(error, "อัปโหลดรูปไม่สำเร็จ"));
  const url = (data?.avatarUrl as string | null) ?? null;
  setMyAvatar(url); // keep the header photo in sync
  return url;
}

export async function removeAvatar(): Promise<void> {
  const { error } = await supabase.functions.invoke("avatar", { body: { action: "remove" } });
  if (error) throw new Error(await functionErrorMessage(error, "ลบรูปไม่สำเร็จ"));
  setMyAvatar(null);
}

// Public view of any user's profile (RPC: profiles RLS only lets you read your own row).
// gameName / contactLinks come back empty unless the caller is signed in.
export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_public_profile", { p_id: id });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ProfileRow[])[0];
  if (!row) return null;
  return { ...toProfile(row), createdAt: row.created_at ?? "" };
}
