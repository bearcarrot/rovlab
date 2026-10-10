import { supabase } from "@/lib/supabase";
import type { SystemRole } from "@/lib/creator";

// Admin user management. Every call goes through a SECURITY DEFINER RPC that checks the caller's role on the server
// (is_admin() / is_super_admin(); others get FORBIDDEN). The UI hides controls too, but the database is the real gate.
// The admin sees the full email: it comes from auth.users via those RPCs.

// รองรับ RPC ใหม่โดยไม่ผูกกับ generated types
type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => PromiseLike<RpcResult> }).rpc(fn, args);

export type UserFilter = "all" | "admin" | "new7" | "reported";
export type VerifiedFilter = "yes" | "no" | "";
export type AccountStatus = "active" | "suspended";

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
  role: SystemRole;
  verifiedCategory: string | null;
  accountStatus: AccountStatus;
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

export interface AdminUserStats {
  total: number;
  verified: number;
  moderators: number;
  admins: number;
  suspended: number;
}

export interface VerificationInfo {
  category: string;
  publicLinks: string[];
  reason: string;
  evidenceRef: string | null;
  verifiedAt: string | null;
  approvedByName: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
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
  authProvider: string | null;
  lastActiveAt: string | null;
  isAdmin: boolean;
  role: SystemRole;
  accountStatus: AccountStatus;
  verifiedCategory: string | null;
  verification: VerificationInfo | null;
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
  from: string | null;
  to: string | null;
  reason: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const role = (v: unknown): SystemRole =>
  v === "moderator" || v === "admin" || v === "super_admin" ? v : "member";
const status = (v: unknown): AccountStatus => (v === "suspended" ? "suspended" : "active");

const toRow = (r: any): AdminUserRow => ({
  id: r.id,
  displayName: r.display_name ?? null,
  handle: r.handle ?? null,
  avatarUrl: r.avatar_url ?? null,
  email: r.email ?? null,
  createdAt: r.created_at,
  lastSignInAt: r.last_sign_in_at ?? null,
  isAdmin: r.is_admin === true,
  role: role(r.role),
  verifiedCategory: str(r.verified_category),
  accountStatus: status(r.account_status),
  lastActiveAt: r.last_active_at ?? null,
  draftCount: num(r.draft_count),
  tierListCount: num(r.tier_list_count),
  commentCount: num(r.comment_count),
  reportCount: num(r.report_count),
});

export async function listUsers(args: {
  q: string;
  filter: UserFilter;
  offset: number;
  limit: number;
  role?: SystemRole | "";
  verified?: VerifiedFilter;
  status?: AccountStatus | "";
}): Promise<AdminUserPage> {
  const { data, error } = await rpc("admin_list_users", {
    p_q: args.q || null,
    p_filter: args.filter,
    p_limit: args.limit,
    p_offset: args.offset,
    p_role: args.role || null,
    p_verified: args.verified || null,
    p_status: args.status || null,
  });
  if (error) throw new Error(error.message || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
  const rows = (data ?? []) as any[];
  return { rows: rows.map(toRow), total: rows.length > 0 ? num(rows[0].total_count) : 0 };
}

export async function getUserStats(): Promise<AdminUserStats> {
  const { data, error } = await rpc("admin_user_stats");
  if (error) throw new Error(error.message || "โหลดสถิติไม่สำเร็จ");
  const d = (data ?? {}) as any;
  return {
    total: num(d.total),
    verified: num(d.verified),
    moderators: num(d.moderators),
    admins: num(d.admins),
    suspended: num(d.suspended),
  };
}

// ใช้ซ่อน/แสดงปุ่มเปลี่ยนบทบาทเท่านั้น ฝั่ง DB ตรวจสิทธิ์จริงอีกชั้น
export async function amISuperAdmin(): Promise<boolean> {
  const { data, error } = await rpc("is_super_admin");
  if (error) return false;
  return data === true;
}

export async function getUserDetail(id: string): Promise<AdminUserDetail> {
  const { data, error } = await rpc("admin_user_detail", { p_id: id });
  if (error) throw new Error(error.message || "โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
  const d = data as any;
  const c = d?.counts ?? {};
  const v = d?.verification;
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
    authProvider: str(d.auth_provider),
    lastActiveAt: d.last_active_at ?? null,
    isAdmin: d.is_admin === true,
    role: role(d.role),
    accountStatus: status(d.account_status),
    verifiedCategory: str(d.verified_category),
    verification: v
      ? {
          category: String(v.category ?? ""),
          publicLinks: Array.isArray(v.public_links) ? v.public_links.filter((x: unknown) => typeof x === "string") : [],
          reason: String(v.reason ?? ""),
          evidenceRef: str(v.evidence_ref),
          verifiedAt: str(v.verified_at),
          approvedByName: str(v.approved_by_name),
          revokedAt: str(v.revoked_at),
          revokeReason: str(v.revoke_reason),
        }
      : null,
    counts: {
      drafts: num(c.drafts),
      publicDrafts: num(c.public_drafts),
      tierLists: num(c.tier_lists),
      publicTierLists: num(c.public_tier_lists),
      comments: num(c.comments),
      hiddenComments: num(c.hidden_comments),
      reportsReceived: num(c.reports_received),
    },
    activity: Object.fromEntries(Object.entries(d.activity_30d ?? {}).map(([k, x]) => [k, num(x)])),
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

// Moderator pin/hide actions (single comment). The history list shows `action` as-is when it has no built-in label,
// so these are translated here.
const COMMENT_ACTION_LABEL: Record<string, string> = {
  pin_comment: "ปักหมุดคอมเมนต์",
  unpin_comment: "เลิกปักหมุดคอมเมนต์",
  hide_comment: "ซ่อนคอมเมนต์",
  unhide_comment: "เลิกซ่อนคอมเมนต์",
};

export async function getAudit(userId: string): Promise<AuditEntry[]> {
  const { data, error } = await rpc("admin_audit_recent", { p_user: userId, p_limit: 20 });
  if (error) throw new Error(error.message || "โหลดประวัติไม่สำเร็จ");
  return ((data ?? []) as any[]).map((r) => {
    const m = r.meta && typeof r.meta === "object" ? r.meta : {};
    return {
      id: r.id,
      createdAt: r.created_at,
      action: COMMENT_ACTION_LABEL[r.action] ?? r.action,
      adminName: r.admin_name ?? null,
      targetName: r.target_name ?? null,
      affected: m.affected != null ? num(m.affected) : null,
      from: str(m.from),
      to: str(m.to),
      reason: str(m.reason),
    };
  });
}

export async function setUserAdmin(id: string, value: boolean): Promise<void> {
  const { error } = await rpc("admin_set_admin", { p_id: id, p_value: value });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
}

// Super Admin เท่านั้น (ตรวจที่ DB): member | moderator | admin | super_admin
export async function setUserRole(id: string, value: SystemRole): Promise<void> {
  const { error } = await rpc("admin_set_role", { p_id: id, p_role: value });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
}

// category = null → ถอดป้าย; ต้องมีเหตุผลทั้งสองกรณี
export async function setVerification(
  id: string,
  category: string | null,
  reason: string,
  links: string[] = [],
  evidence: string | null = null
): Promise<void> {
  const { error } = await rpc("admin_set_verification", {
    p_id: id,
    p_category: category,
    p_reason: reason,
    p_links: links,
    p_evidence: evidence,
  });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
}

export async function setAccountStatus(id: string, value: AccountStatus, reason: string): Promise<void> {
  const { error } = await rpc("admin_set_account_status", { p_id: id, p_status: value, p_reason: reason });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
}

export async function moderateUser(id: string, action: ModerateAction): Promise<number> {
  const { data, error } = await rpc("admin_moderate_user", { p_id: id, p_action: action });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
  return num(data);
}
