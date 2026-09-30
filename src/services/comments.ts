import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { HeroComment } from "@/types/comment";

// Mirrors the DB check constraint comments_body_length (1-500 chars after trim).
export const COMMENT_MAX_LENGTH = 500;

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  avatar_url: string | null;
};

// Reads go through the list_hero_comments RPC: profiles RLS only lets a user read
// their own row, so the function returns just display_name/avatar_url alongside each comment.
export async function listHeroComments(heroSlug: string): Promise<HeroComment[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("list_hero_comments", { p_hero_slug: heroSlug, p_limit: 50 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as CommentRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
    authorName: r.author_name?.trim() || "ผู้เล่นนิรนาม",
    avatarUrl: r.avatar_url ?? null,
  }));
}

export async function addHeroComment(heroSlug: string, userId: string, body: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("ยังไม่ได้เชื่อม Supabase");
  const text = body.trim();
  if (text.length === 0 || text.length > COMMENT_MAX_LENGTH) {
    throw new Error(`ความคิดเห็นต้องยาว 1–${COMMENT_MAX_LENGTH} ตัวอักษร`);
  }
  const { error } = await supabase.from("comments").insert({ user_id: userId, hero_slug: heroSlug, body: text });
  if (error) {
    // DB trigger comments_rate_limit_trg raises this when a user posts twice within 10 seconds
    if (error.message.includes("comment_rate_limited")) throw new Error("ส่งถี่เกินไป รอสักครู่แล้วลองใหม่");
    throw new Error(error.message);
  }
}

// RLS: a user can delete their own comments (admins can delete any).
export async function deleteHeroComment(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
