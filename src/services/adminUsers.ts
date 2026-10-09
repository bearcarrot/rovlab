import { supabase } from "@/lib/supabase";

// Admin user management. Every call goes through a SECURITY DEFINER RPC that checks is_admin() on the server
// (non-admins get FORBIDDEN). The admin sees the full email: it comes from auth.users via those RPCs.

export type UserFilter = "all" | "admin" | "new7" | "reported";

export type ModerateAction =
  | "remove_avatar"
  | "clear_bio"
  | "clear_game_name"
  | "clear_contacts"
  | "hide_comments"
  | "unhide_comments";

export interface AdminUserRow {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  lastActiveAt: string | null;
  draftCount: number;
  tierListCount: number;
  commentCount: number;
  reportCount: number;
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  total: number;
}

export interface AdminUserDetail {
  id: string;
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  gameName: string | null;
  contactLinks: { app: string; url: string }[];
  createdAt: string;
  email: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  isAdmin: boolean;
  counts: {
    drafts: number;
    publicDrafts: number;
    tierLists: number;
    publicTierLists: number;
    comments: number;
    hiddenComments: number;
    reportsReceived: number;
  };
  activity: Record<string, number>;
  recentComments: { id: string; body: string; heroSlug: string | null; hidden: boolean; createdAt: string }[];
  reports: { commentId: string; reason: string; detail: string; createdAt: string }[];
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  action: string;
  adminName: string | null;
  targetName: string | null;
  affected: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toRow = (r: any): AdminUserRow => ({
  id: r.id,
  displayName: r.display_name ?? null,
  handle: r.handle ?? null,
  avatarUrl: r.avatar_url ?? null,
  email: r.email ?? null,
  createdAt: r.created_at,
  lastSignInAt: r.last_sign_in_at ?? null,
  isAdmin: r.is_admin === true,
  lastActiveAt: r.last_active_at ?? null,
  draftCount: num(r.draft_count),
  tierListCount: num(r.tier_list_count),
  commentCount: num(r.comment_count),
  reportCount: num(r.report_count),
});

export async function listUsers(args: { q: string; filter: UserFilter; offset: number; limit: number }): Promise<AdminUserPage> {
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_q: args.q || null,
    p_filter: args.filter,
    p_limit: args.limit,
    p_offset: args.offset,
  });
  if (error) throw new Error(error.message || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
  const rows = (data ?? []) as any[];
  return { rows: rows.map(toRow), total: rows.length > 0 ? num(rows[0].total_count) : 0 };
}

export async function getUserDetail(id: string): Promise<AdminUserDetail> {
  const { data, error } = await supabase.rpc("admin_user_detail", { p_id: id });
  if (error) throw new Error(error.message || "โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
  const d = data as any;
  const c = d?.counts ?? {};
  return {
    id: d.id,
    displayName: d.display_name ?? null,
    handle: d.handle ?? null,
    avatarUrl: d.avatar_url ?? null,
    bio: d.bio ?? null,
    gameName: d.game_name ?? null,
    contactLinks: Array.isArray(d.contact_links)
      ? d.contact_links
          .filter((l: any) => l && typeof l.app === "string" && typeof l.url === "string")
          .map((l: any) => ({ app: l.app, url: l.url }))
      : [],
    createdAt: d.created_at,
    email: d.email ?? null,
    emailConfirmedAt: d.email_confirmed_at ?? null,
    lastSignInAt: d.last_sign_in_at ?? null,
    lastActiveAt: d.last_active_at ?? null,
    isAdmin: d.is_admin === true,
    counts: {
      drafts: num(c.drafts),
      publicDrafts: num(c.public_drafts),
      tierLists: num(c.tier_lists),
      publicTierLists: num(c.public_tier_lists),
      comments: num(c.comments),
      hiddenComments: num(c.hidden_comments),
      reportsReceived: num(c.reports_received),
    },
    activity: Object.fromEntries(Object.entries(d.activity_30d ?? {}).map(([k, v]) => [k, num(v)])),
    recentComments: ((d.recent_comments ?? []) as any[]).map((x) => ({
      id: x.id,
      body: x.body ?? "",
      heroSlug: x.hero_slug ?? null,
      hidden: x.hidden === true,
      createdAt: x.created_at,
    })),
    reports: ((d.reports ?? []) as any[]).map((x) => ({
      commentId: x.comment_id,
      reason: x.reason ?? "",
      detail: x.detail ?? "",
      createdAt: x.created_at,
    })),
  };
}

export async function getAudit(userId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc("admin_audit_recent", { p_user: userId, p_limit: 20 });
  if (error) throw new Error(error.message || "โหลดประวัติไม่สำเร็จ");
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    action: r.action,
    adminName: r.admin_name ?? null,
    targetName: r.target_name ?? null,
    affected: r.meta && typeof r.meta === "object" && r.meta.affected != null ? num(r.meta.affected) : null,
  }));
}

export async function setUserAdmin(id: string, value: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_admin", { p_id: id, p_value: value });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
}

export async function moderateUser(id: string, action: ModerateAction): Promise<number> {
  const { data, error } = await supabase.rpc("admin_moderate_user", { p_id: id, p_action: action });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
  return num(data);
}
