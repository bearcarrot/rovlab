import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Contact form (/contact). Guests and members both go through submit_contact_message
// (validated + rate-limited on the server); the table itself is not readable from the client.

export type ContactTopic = "feedback" | "data_error" | "privacy" | "copyright" | "other";

export const CONTACT_TOPICS: { value: ContactTopic; label: string }[] = [
  { value: "feedback", label: "ติชม / เสนอแนะ" },
  { value: "data_error", label: "แจ้งข้อมูลผิดหรือล้าสมัย" },
  { value: "privacy", label: "ข้อมูลส่วนบุคคล / ขอลบบัญชี" },
  { value: "copyright", label: "ลิขสิทธิ์ / ขอให้นำเนื้อหาออก" },
  { value: "other", label: "อื่น ๆ" },
];

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
    p_page: document.referrer && new URL(document.referrer, window.location.origin).origin === window.location.origin
      ? new URL(document.referrer).pathname.slice(0, 300)
      : null,
  });
  if (error) throw new Error(error.message || "ส่งข้อความไม่สำเร็จ");
}
