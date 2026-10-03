import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const RESERVED_USERNAMES = ["admin", "administrator", "moderator", "support", "system", "rovlab", "coachai"];

// คืนข้อความ error (ภาษาไทย) หรือ null ถ้าผ่าน
export function validateUsername(value: string): string | null {
  const v = value.trim();
  if (v.length < 3 || v.length > 20) return "Username ต้องยาว 3–20 ตัวอักษร";
  if (!USERNAME_RE.test(v)) return "Username ใช้ได้เฉพาะ a-z, 0-9 และ _";
  if (RESERVED_USERNAMES.includes(v.toLowerCase())) return "Username นี้ถูกสงวนไว้";
  return null;
}

// เช็กซ้ำกับ DB (ไม่สนตัวพิมพ์เล็ก/ใหญ่) — ตัวกันจริงคือ unique index + trigger ใน DB
export async function checkUsernameAvailable(value: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const { data, error } = await supabase.rpc("username_available", { p_username: value.trim() });
  if (error) return true;
  return data === true;
}
