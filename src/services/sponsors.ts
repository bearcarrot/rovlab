import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Admin side of the Home-page sponsors (tab "ผู้สนับสนุน" in /admin). Migration: supabase/migrations/20261028c_sponsors.sql.
// Reads use the table API with an explicit column list (created_by has no client grant); admins also see drafts/archived through RLS.
// Every write goes through SECURITY DEFINER RPCs that check is_admin() on the server.

export type SponsorStatus = "draft" | "published" | "archived";

export interface Sponsor {
  id: string;
  name: string;
  tagline: string;
  logo_url: string | null;
  link_url: string;
  status: SponsorStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorInput {
  name: string;
  tagline: string;
  logoUrl: string | null;
  linkUrl: string;
  startsAt: string | null;
  endsAt: string | null;
}

const COLUMNS = "id,name,tagline,logo_url,link_url,status,starts_at,ends_at,created_at,updated_at";

function ensureConfigured(): void {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured");
}

// The RPCs raise Thai messages, so error.message is already user-facing.
const fail = (error: { message?: string }, fallback: string): Error => new Error(error.message || fallback);

export async function listAllSponsors(): Promise<Sponsor[]> {
  ensureConfigured();
  const { data, error } = await supabase.from("sponsors").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (error) throw fail(error, "โหลดรายการผู้สนับสนุนไม่สำเร็จ");
  return (data ?? []) as unknown as Sponsor[];
}

export async function saveSponsor(id: string | null, input: SponsorInput): Promise<string> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("admin_save_sponsor", {
    p_id: id,
    p_name: input.name,
    p_tagline: input.tagline,
    p_logo_url: input.logoUrl,
    p_link_url: input.linkUrl,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
  });
  if (error) throw fail(error, "บันทึกไม่สำเร็จ");
  return data as unknown as string;
}

export async function setSponsorStatus(id: string, status: SponsorStatus): Promise<void> {
  ensureConfigured();
  const { error } = await supabase.rpc("admin_set_sponsor_status", { p_id: id, p_status: status });
  if (error) throw fail(error, "เปลี่ยนสถานะไม่สำเร็จ");
}

// Returns the deleted row's logo_url so the caller can remove the stored file.
export async function deleteSponsor(id: string): Promise<string | null> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("admin_delete_sponsor", { p_id: id });
  if (error) throw fail(error, "ลบไม่สำเร็จ");
  return (data ?? null) as unknown as string | null;
}
