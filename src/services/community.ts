import { supabase } from "@/lib/supabase";
import type {
  CommentRow,
  CommentSort,
  EmojiKey,
  FeedItem,
  HandleSuggestion,
  NotificationItem,
  NotificationType,
  ReportReason,
} from "@/types/community";

export const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

// DB triggers raise these (message is already Thai, detail carries the code).
const KNOWN_CODES = new Set(["PROFANITY_BLOCKED", "HANDLE_BLOCKED", "DISPLAY_NAME_BLOCKED", "PARENT_NOT_FOUND", "FORBIDDEN"]);

export function communityError(e: unknown, fallback: string): string {
  const err = e as { message?: string; details?: string; code?: string } | null;
  if (err?.details && KNOWN_CODES.has(err.details) && err.message) return err.message;
  if (err?.message?.includes("comment_rate_limited")) return "ส่งถี่เกินไป รอสักครู่แล้วลองใหม่";
  if (err?.code === "23505") return "ทำรายการนี้ไปแล้ว";
  if (err?.code === "42501") return "ไม่มีสิทธิ์ทำรายการนี้ (ต้องล็อกอิน)";
  return fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): CommentRow {
  return {
    id: r.id,
    parentId: r.parent_id,
    userId: r.user_id,
    authorName: r.author_name,
    handle: r.handle,
    avatarUrl: r.avatar_url,
    isAdmin: Boolean(r.is_admin),
    replyToName: r.reply_to_name,
    replyToHandle: r.reply_to_handle,
    body: r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
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

// Hard delete (existing RLS: own comments, or admin). Replies of a deleted top-level comment are removed with it.
export async function deleteComment(id: string) {
  const { error } = await supabase.from("comments").delete().eq("id", id);
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

// existing zero-arg is_admin() (admin_users)
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

// ---------- handles ----------
export async function searchHandles(query: string): Promise<HandleSuggestion[]> {
  const q = query.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
  if (!q) return [];
  const { data, error } = await supabase.rpc("search_handles", { p_q: q });
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({ id: p.id, handle: p.handle, displayName: p.display_name, avatarUrl: p.avatar_url }));
}

export async function resolveHandle(handle: string): Promise<string | null> {
  if (!HANDLE_RE.test(handle)) return null;
  const { data, error } = await supabase.rpc("resolve_handle", { p_handle: handle });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function getMyHandle(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data?.handle as string | undefined) ?? null;
}

export async function updateMyHandle(userId: string, handle: string) {
  const { error } = await supabase.from("profiles").update({ handle }).eq("id", userId);
  if (error) throw error;
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

export async function getFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("followee_id", userId);
  if (error) return 0;
  return count ?? 0;
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
    authorName: r.author_name,
    handle: r.handle,
    avatarUrl: r.avatar_url,
  }));
}

// ---------- notifications ----------
export async function listNotifications(limit = 50): Promise<NotificationItem[]> {
  const { data, error } = await supabase.rpc("list_notifications", { p_limit: limit });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    type: r.type as NotificationType,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorHandle: r.actor_handle,
    commentId: r.comment_id,
    heroSlug: r.hero_slug,
    createdAt: r.created_at,
    readAt: r.read_at,
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
