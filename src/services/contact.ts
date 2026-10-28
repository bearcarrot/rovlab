import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Contact form (/contact). Guests and members both go through submit_contact_message
// (validated + rate-limited on the server); the table itself is not readable from the client.
// The admin calls at the bottom are SECURITY DEFINER RPCs that check is_admin() on the server.

export type ContactTopic = "feedback" | "data_error" | "privacy" | "copyright" | "advertising" | "other";

// Keep in step with the topic whitelist in supabase/migrations/20261028b_contact_topic_advertising.sql.
export const CONTACT_TOPICS: { value: ContactTopic; label: string }[] = [
  { value: "feedback", label: "ติชม / เสนอแนะ" },
  { value: "data_error", label: "แจ้งข้อมูลผิดหรือล้าสมัย" },
  { value: "privacy", label: "ข้อมูลส่วนบุคคล / ขอลบบัญชี" },
  { value: "copyright", label: "ลิขสิทธิ์ / ขอให้นำเนื้อหาออก" },
  { value: "advertising", label: "ลงโฆษณา / ผู้สนับสนุน" },
  { value: "other", label: "อื่น ๆ" },
];

// /contact?topic=advertising preselects a topic; anything unknown falls back to the default.
export function topicFromParam(v: string | null): ContactTopic {
  return CONTACT_TOPICS.some((t) => t.value === v) ? (v as ContactTopic) : "feedback";
}

export const MAX_NAME = 80;
export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 2000;

export interface ContactInput {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
}

export async function submitContactMessage(input: ContactInput): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("submit_contact_message", {
    p_name: input.name.trim().slice(0, MAX_NAME),
    p_email: input.email.trim(),
    p_topic: input.topic,
    p_message: input.message.trim().slice(0, MAX_MESSAGE),
  });
  if (error) throw new Error(error.message || "ส่งข้อความไม่สำเร็จ");
}

// ---------------- admin ----------------

export type ContactStatus = "new" | "replied" | "closed";

export interface ContactCounts {
  newCount: number;
  total: number;
}

export interface ContactRow {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  status: ContactStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  userId: string | null;
  displayName: string | null;
  handle: string | null;
}

export interface ContactPage {
  rows: ContactRow[];
  total: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getContactCounts(): Promise<ContactCounts> {
  const { data, error } = await supabase.rpc("admin_contact_counts");
  if (error) throw new Error(error.message || "โหลดข้อมูลไม่สำเร็จ");
  return { newCount: num(data?.new), total: num(data?.total) };
}

export async function listContactMessages(opts: {
  status: ContactStatus | "all";
  offset: number;
  limit: number;
}): Promise<ContactPage> {
  const { data, error } = await supabase.rpc("admin_list_contact_messages", {
    p_status: opts.status,
    p_limit: opts.limit,
    p_offset: opts.offset,
  });
  if (error) throw new Error(error.message || "โหลดรายการไม่สำเร็จ");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map(
    (r): ContactRow => ({
      id: r.id,
      createdAt: r.created_at,
      name: r.name,
      email: r.email,
      topic: r.topic,
      message: r.message,
      status: r.status,
      adminNote: r.admin_note ?? null,
      reviewedAt: r.reviewed_at ?? null,
      userId: r.user_id ?? null,
      displayName: r.display_name ?? null,
      handle: r.handle ?? null,
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total = num((data as any[] | null)?.[0]?.total_count);
  return { rows, total };
}

export async function updateContactMessage(id: string, status: ContactStatus, note: string): Promise<void> {
  const { error } = await supabase.rpc("admin_update_contact_message", {
    p_id: id,
    p_status: status,
    p_note: note.trim() || null,
  });
  if (error) throw new Error(error.message || "บันทึกไม่สำเร็จ");
}
