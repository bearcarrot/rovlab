import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Announcement, Status } from "@/features/announcements/types";
import { ERROR_TH, type SaveInput } from "@/features/announcements/form";
import { checkImageFile, objectNameFromUrl } from "@/features/announcements/upload";
import { removeAnnouncementFile, uploadAnnouncementFile } from "@/lib/r2Upload";

// Announcements (spec: docs/superpowers/specs/2026-10-16-announcements-design.md).
// READS go through the table API with an explicit column list (created_by has no client grant, so select("*") would fail).
// WRITES (admin) go through SECURITY DEFINER RPCs that check is_admin() on the server. Dismissals are written by an RPC only.

export const ANNOUNCEMENT_COLUMNS =
  "id,title,content,media_type,media_url,link_url,link_label,status,priority,is_dismissible,starts_at,ends_at,created_at,updated_at";

export class AnnouncementError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AnnouncementError";
    this.code = code;
  }
}

// PostgREST puts the RAISE ... DETAIL value of our RPC errors in `details` (e.g. "FORBIDDEN", "INVALID_TRANSITION").
function toError(error: { message?: string; details?: string | null }, fallback: string): AnnouncementError {
  const code = typeof error.details === "string" && /^[A-Z_]+$/.test(error.details) ? error.details : "UNKNOWN";
  return new AnnouncementError(code, ERROR_TH[code] ?? (error.message || fallback));
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured");
}

// ---------------- public ----------------

// RLS returns only published rows inside their schedule window; the caller sorts/filters further (visibility.ts).
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw toError(error, "โหลดประกาศไม่สำเร็จ");
  return (data ?? []) as unknown as Announcement[];
}

// Server clock + next instant at which the public set changes (timestamps only, no content).
export async function fetchSchedule(): Promise<{ serverNow: string; nextChange: string | null }> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("get_announcement_schedule");
  if (error) throw toError(error, "โหลดเวลาประกาศไม่สำเร็จ");
  const row = (Array.isArray(data) ? data[0] : data) as { server_now?: string; next_change?: string | null } | null | undefined;
  if (!row || typeof row.server_now !== "string") throw new Error("invalid schedule response");
  return { serverNow: row.server_now, nextChange: row.next_change ?? null };
}

// Signed-in users only (RLS: own rows).
export async function fetchMyDismissals(): Promise<string[]> {
  ensureConfigured();
  const { data, error } = await supabase.from("announcement_dismissals").select("announcement_id");
  if (error) throw toError(error, "โหลดประกาศที่ซ่อนไม่สำเร็จ");
  return ((data ?? []) as unknown as { announcement_id: string }[]).map((r) => r.announcement_id);
}

export async function pushDismissals(ids: string[]): Promise<void> {
  ensureConfigured();
  const { error } = await supabase.rpc("dismiss_announcements", { p_ids: ids });
  if (error) throw toError(error, "บันทึกการซ่อนประกาศไม่สำเร็จ");
}

// ---------------- admin ----------------

// Admins also see drafts/archived through the admin RLS policy.
export async function listAllAnnouncements(): Promise<Announcement[]> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw toError(error, "โหลดรายการประกาศไม่สำเร็จ");
  return (data ?? []) as unknown as Announcement[];
}

export async function saveAnnouncement(id: string | null, input: SaveInput): Promise<string> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("admin_save_announcement", {
    p_id: id,
    p_title: input.title,
    p_content: input.content,
    p_media_type: input.mediaType,
    p_media_url: input.mediaUrl,
    p_link_url: input.linkUrl,
    p_link_label: input.linkLabel,
    p_priority: input.priority,
    p_is_dismissible: input.isDismissible,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
  });
  if (error) throw toError(error, "บันทึกประกาศไม่สำเร็จ");
  return data as unknown as string;
}

export async function setAnnouncementStatus(id: string, status: Status): Promise<void> {
  ensureConfigured();
  const { error } = await supabase.rpc("admin_set_announcement_status", { p_id: id, p_status: status });
  if (error) throw toError(error, "เปลี่ยนสถานะไม่สำเร็จ");
}

// Returns the deleted row's media_url so the caller can clean up storage (see features/announcements/cleanup.ts).
export async function deleteAnnouncement(id: string): Promise<string | null> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("admin_delete_announcement", { p_id: id });
  if (error) throw toError(error, "ลบประกาศไม่สำเร็จ");
  return (data ?? null) as unknown as string | null;
}

// ---------------- admin: image storage (Cloudflare R2 via /api/upload, see docs/r2-uploads.md) ----------------

// Validates on the client (type, 2 MB, magic bytes) for fast feedback; the server re-validates, authorises (is_admin),
// builds the key announcements/<uuid>.<ext> and returns the public https://assets.rovlab.app/... URL.
export async function uploadAnnouncementImage(file: File): Promise<string> {
  ensureConfigured();
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const problem = checkImageFile({ type: file.type, size: file.size }, head);
  if (problem !== null) throw new AnnouncementError("UPLOAD_INVALID", problem);
  try {
    return await uploadAnnouncementFile(file);
  } catch {
    throw new AnnouncementError("UPLOAD_FAILED", "อัปโหลดรูปไม่สำเร็จ");
  }
}

// Only objects that follow our own naming scheme on our own R2 domain are ever removed (the server re-checks). true = an object was removed.
// Legacy Supabase Storage URLs never match, so they are left untouched.
export async function removeAnnouncementImage(url: string): Promise<boolean> {
  ensureConfigured();
  if (objectNameFromUrl(url) === null) return false;
  return removeAnnouncementFile(url).catch(() => false);
}

// How many other announcements still use this image (admin RLS sees every row).
export async function countMediaReferences(url: string, excludeId: string | null): Promise<number> {
  ensureConfigured();
  let query = supabase.from("announcements").select("id", { count: "exact", head: true }).eq("media_url", url);
  if (excludeId !== null) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) throw toError(error, "ตรวจสอบการใช้รูปไม่สำเร็จ");
  return count ?? 0;
}
