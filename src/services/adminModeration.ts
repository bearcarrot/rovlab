import { supabase } from "@/lib/supabase";

// แอดมินดูแล Community Draft / Community Tier List: ซ่อน · เลิกซ่อน · ลบถาวร (บันทึกลง admin_audit_log)
// ทุกการเรียกผ่าน RPC แบบ SECURITY DEFINER ที่ตรวจ is_admin() ที่ฝั่ง DB (ดู supabase/migrations/20261028_admin_community_moderation.sql)
// Item Build และ Combo ใช้บริการเดิม (userBuilds.ts / combos.ts) ซึ่งบังคับสิทธิ์ที่ RLS + trigger อยู่แล้ว

// รองรับ RPC ใหม่โดยไม่ผูกกับ generated types (แบบเดียวกับ adminUsers.ts)
type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => PromiseLike<RpcResult> }).rpc(fn, args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export type ModerationKind = "draft" | "tier_list";

export interface ModerationItem {
  id: string;
  ownerId: string;
  authorName: string | null;
  handle: string | null;
  title: string;
  /** Draft: format (single/bo3/...) · Tier List: patch */
  detail: string | null;
  /** Tier List only */
  heroCount: number | null;
  version: number;
  hidden: boolean;
  likes: number;
  dislikes: number;
  publishedAt: string;
}

export interface ModerationBuild {
  id: string;
  name: string;
  heroName: string;
  hidden: boolean;
  publishedAt: string | null;
}

export const MODERATION_LIMIT = 100;

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function listCommunityContent(kind: ModerationKind, q: string): Promise<ModerationItem[]> {
  const { data, error } = await rpc("admin_list_community_content", {
    p_kind: kind,
    p_q: q.trim() || null,
    p_limit: MODERATION_LIMIT,
    p_offset: 0,
  });
  if (error) throw new Error(error.message || "โหลดรายการไม่สำเร็จ");
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    authorName: r.author_name ?? null,
    handle: r.handle ?? null,
    title: r.title ?? "",
    detail: r.detail ?? null,
    heroCount: r.hero_count == null ? null : num(r.hero_count),
    version: num(r.version) || 1,
    hidden: r.hidden === true,
    likes: num(r.like_count),
    dislikes: num(r.dislike_count),
    publishedAt: r.published_at,
  }));
}

export async function setCommunityHidden(kind: ModerationKind, id: string, hidden: boolean): Promise<void> {
  const { error } = await rpc("admin_set_community_hidden", { p_kind: kind, p_id: id, p_hidden: hidden });
  if (error) throw new Error(error.message || "ทำรายการไม่สำเร็จ");
}

// ลบถาวร: ลบสแนปชอตใน Community (พร้อมคะแนนถูกใจ/ไม่ถูกใจ) และตั้งต้นฉบับของเจ้าของกลับเป็นส่วนตัว — ต้นฉบับไม่ถูกลบ
export async function deleteCommunityContent(kind: ModerationKind, id: string): Promise<void> {
  const { error } = await rpc("admin_delete_community_content", { p_kind: kind, p_id: id });
  if (error) throw new Error(error.message || "ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
}

// Item Build ที่เผยแพร่แล้ว (รวมที่ถูกซ่อน) — แอดมินอ่านได้ทั้งหมดผ่าน RLS; ซ่อน/ลบใช้ setBuildHidden / deleteBuild ใน userBuilds.ts
export async function listPublishedBuilds(): Promise<ModerationBuild[]> {
  const { data, error } = await db
    .from("user_builds")
    .select("id, name, hidden, published_at, heroes(name, name_th)")
    .eq("is_public", true)
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message || "โหลดรายการไม่สำเร็จ");
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    name: r.name ?? "",
    heroName: r.heroes?.name_th ?? r.heroes?.name ?? "",
    hidden: r.hidden === true,
    publishedAt: r.published_at ?? null,
  }));
}
