import { supabase } from "@/lib/supabase";
import type {
  CommentRow,
  CommentSort,
  EmojiKey,
  FeedItem,
  NotificationItem,
  NotificationType,
  PublicProfile,
  ReportReason,
} from "@/types/community";

export const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

// Server (DB triggers) raises these codes — map them to Thai messages.
const ERROR_TEXT: Record<string, string> = {
  PROFANITY_BLOCKED: "ข้อความมีคำที่ไม่เหมาะสม กรุณาแก้ไขก่อนส่ง",
  HANDLE_BLOCKED: "ชื่อผู้ใช้มีคำที่ไม่เหมาะสม",
  DISPLAY_NAME_BLOCKED: "ชื่อที่แสดงมีคำที่ไม่เหมาะสม",
  RATE_LIMITED: "ส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  COMMENT_EMPTY: "กรุณาพิมพ์ข้อความ",
  PARENT_NOT_FOUND: "ไม่พบความคิดเห็นที่ต้องการตอบกลับ (อาจถูกลบแล้ว)",
  COMMENT_DELETED: "ความคิดเห็นนี้ถูกลบแล้ว",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
};

export function communityError(e: unknown, fallback: string): string {
  const err = e as { message?: string; code?: string } | null;
  const msg = err?.message ?? "";
  for (const key of Object.keys(ERROR_TEXT)) if (msg.includes(key)) return ERROR_TEXT[key];
  if (err?.code === "23505") return "ทำรายการนี้ไปแล้ว";
  if (err?.code === "42501") return "ไม่มีสิทธิ์ทำรายการนี้ (ต้องล็อกอิน)";
  return fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): CommentRow {
  return {
    id: r.id,
    parentId: r.parent_id,
    replyToHandle: r.reply_to_handle,
    userId: r.user_id,
    handle: r.handle,
    avatarUrl: r.avatar_url,
    isAdmin: Boolean(r.is_admin),
    body: r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deleted: Boolean(r.deleted),
    pinned: Boolean(r.pinned),
    hidden: Boolean(r.hidden),
    likeCount: r.like_count ?? 0,
    dislikeCount: r.dislike_count ?? 0,
    replyCount: r.reply_count ?? 0,
    emojiCounts: r.emoji_counts ?? {},
    myValue: r.my_value === 1 ? 1 : r.my_value === -1 ? -1 : null,
    myEmojis: (r.my_emojis ?? []) as EmojiKey[],
  };
}

// ---------- comments ----------
export async function listComments(args: {
  heroSlug: string;
  parentId?: string | null;
  sort?: CommentSort;
  limit?: number;
  offset?: number;
  onlyId?: string | null;
}): Promise<CommentRow[]> {
  const { data, error } = await supabase.rpc("list_comments", {
    p_hero_slug: args.heroSlug,
    p_parent_id: args.parentId ?? null,
    p_sort: args.sort ?? "top",
    p_limit: args.limit ?? 20,
    p_offset: args.offset ?? 0,
    p_only_id: args.onlyId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getComment(heroSlug: string, id: string): Promise<CommentRow | null> {
  const rows = await listComments({ heroSlug, onlyId: id, limit: 1 });
  return rows[0] ?? null;
}

export async function postComment(args: { userId: string; heroSlug: string; body: string; parentId?: string | null }): Promise<string> {
  const { data, error } = await supabase
    .from("comments")
    .insert({ user_id: args.userId, hero_slug: args.heroSlug, body: args.body, parent_id: args.parentId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function editComment(id: string, body: string) {
  const { error } = await supabase.from("comments").update({ body }).eq("id", id);
  if (error) throw error;
}

export async function deleteComment(id: string) {
  // soft delete: the DB trigger stamps deleted_at and clears the body
  const { error } = await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ---------- reactions ----------
export async function setReaction(commentId: string, userId: string, value: 1 | -1 | null) {
  if (value === null) {
    const { error } = await supabase.from("comment_reactions").delete().eq("comment_id", commentId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("comment_reactions")
    .upsert({ comment_id: commentId, user_id: userId, value }, { onConflict: "comment_id,user_id" });
  if (error) throw error;
}

export async function setEmoji(commentId: string, userId: string, emoji: EmojiKey, on: boolean) {
  if (on) {
    const { error } = await supabase.from("comment_emojis").insert({ comment_id: commentId, user_id: userId, emoji });
    if (error && error.code !== "23505") throw error;
    return;
  }
  const { error } = await supabase
    .from("comment_emojis")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .eq("emoji", emoji);
  if (error) throw error;
}

// ---------- moderation ----------
export async function reportComment(commentId: string, userId: string, reason: ReportReason, detail: string) {
  const { error } = await supabase
    .from("comment_reports")
    .insert({ comment_id: commentId, reporter_id: userId, reason, detail: detail.trim() || null });
  if (error) throw error;
}

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== "23505") throw error;
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}

export async function adminSetFlags(id: string, flags: { pinned?: boolean; hidden?: boolean }) {
  const { error } = await supabase.rpc("admin_set_comment_flags", {
    p_id: id,
    p_pinned: flags.pinned ?? null,
    p_hidden: flags.hidden ?? null,
  });
  if (error) throw error;
}

// ---------- people ----------
export async function searchHandles(query: string): Promise<PublicProfile[]> {
  const q = query.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
  if (!q) return [];
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, handle, avatar_url")
    .ilike("handle", `${q.replace(/_/g, "\\_")}%`)
    .limit(6);
  if (error) return [];
  return (data ?? []).map((p) => ({ id: p.id, handle: p.handle, avatarUrl: p.avatar_url }));
}

export async function getProfileByHandle(handle: string): Promise<PublicProfile | null> {
  if (!HANDLE_RE.test(handle)) return null;
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, handle, avatar_url")
    .ilike("handle", handle.replace(/_/g, "\\_"))
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, handle: data.handle, avatarUrl: data.avatar_url } : null;
}

export async function getUserComments(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("comments")
    .select("id, hero_slug, body, created_at, like_count")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("hidden", false)
    .not("hero_slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    heroSlug: c.hero_slug as string,
    body: c.body as string,
    createdAt: c.created_at as string,
    likeCount: (c.like_count ?? 0) as number,
  }));
}

// ---------- follows / feed ----------
export async function getFollowState(me: string, target: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("follower_id", me)
    .eq("followee_id", target);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [a, b] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", userId),
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0 };
}

export async function setFollow(me: string, target: string, on: boolean) {
  if (on) {
    const { error } = await supabase.from("follows").insert({ follower_id: me, followee_id: target });
    if (error && error.code !== "23505") throw error;
    return;
  }
  const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", target);
  if (error) throw error;
}

export async function getFollowingFeed(limit = 30): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc("following_feed", { p_limit: limit, p_offset: 0 });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    heroSlug: r.hero_slug,
    body: r.body,
    createdAt: r.created_at,
    parentId: r.parent_id,
    userId: r.user_id,
    handle: r.handle,
    avatarUrl: r.avatar_url,
  }));
}

// ---------- notifications ----------
export async function listNotifications(userId: string, limit = 50): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, actor_id, type, comment_id, hero_slug, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id as string))];
  const handles = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: ps } = await supabase.from("public_profiles").select("id, handle").in("id", actorIds);
    for (const p of ps ?? []) handles.set(p.id as string, p.handle as string);
  }
  return rows.map((r) => ({
    id: r.id as string,
    type: r.type as NotificationType,
    actorId: r.actor_id as string,
    actorHandle: handles.get(r.actor_id as string) ?? "ผู้ใช้",
    commentId: (r.comment_id as string | null) ?? null,
    heroSlug: (r.hero_slug as string | null) ?? null,
    createdAt: r.created_at as string,
    readAt: (r.read_at as string | null) ?? null,
  }));
}

export async function countUnread(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}
