// ตรวจรูปแบบอีเมลฝั่งแอป (ก่อนส่งให้ Supabase) — type="email" ของเบราว์เซอร์ยอมให้ a@b ผ่าน เลยต้องเช็คเพิ่ม
// ไม่รองรับโดเมนภาษาไทย/IDN (ต้องเป็น ASCII); ตัวตัดสินจริงคือ Supabase + การยืนยันอีเมล
const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
const EMAIL_RE = new RegExp(`^[A-Za-z0-9._%+-]{1,64}@(?:${LABEL}\\.)+[A-Za-z]{2,}$`);

// คืนข้อความ error (ภาษาไทย) หรือ null ถ้าผ่าน
export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "กรุณากรอกอีเมล";
  if (/\s/.test(v)) return "อีเมลต้องไม่มีช่องว่าง";
  if (v.length > 254) return "อีเมลยาวเกินไป";
  if (!v.includes("@")) return "อีเมลต้องมีเครื่องหมาย @ เช่น name@example.com";
  if ((v.match(/@/g) ?? []).length > 1) return "อีเมลต้องมี @ เพียงตัวเดียว";
  const [local, domain] = v.split("@");
  if (!local) return "กรุณาใส่ชื่อก่อนเครื่องหมาย @";
  if (!domain) return "กรุณาใส่โดเมนหลัง @ เช่น example.com";
  if (!domain.includes(".")) return "โดเมนอีเมลต้องมีจุด เช่น example.com";
  if (local.startsWith(".") || local.endsWith(".") || v.includes("..")) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (!EMAIL_RE.test(v)) return "รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com";
  return null;
}
