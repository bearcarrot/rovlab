// รูปใน bucket hero-icons โหลดผ่าน /img/* (rewrite ใน vercel.json) เพื่อให้ Vercel cache ไว้
// และไม่ให้ทุก request ไปติด API Gateway log ของ Supabase; URL อื่นคืนค่าเดิม
const STORAGE_PREFIX = "https://mttcdaiwuasnkqlxbeqs.supabase.co/storage/v1/object/public/hero-icons/";

export function imgUrl<T extends string | null | undefined>(url: T): T {
  return (typeof url === "string" && url.startsWith(STORAGE_PREFIX) ? `/img/${url.slice(STORAGE_PREFIX.length)}` : url) as T;
}
