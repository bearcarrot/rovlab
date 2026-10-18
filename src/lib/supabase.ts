import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// คำขอข้อมูลอ้างอิงของหน้าแรกถูกยิงล่วงหน้าจากสคริปต์ใน index.html (window.__earlyFetch) ตั้งแต่ parse HTML
// ที่นี่หยิบผลมาใช้ "ครั้งเดียว" เมื่อ URL ตรงเป๊ะ + เป็น GET + Accept ตรง + ยังไม่ login (Authorization = anon key)
// อย่างอื่น (ไม่ตรง/เก่าเกิน 15 วิ/prefetch พลาด) ตกกลับไปใช้ fetch ปกติ จึงไม่เปลี่ยนพฤติกรรมของแอป
type Early = { p: Promise<Response>; t: number };
const EARLY_MAX_AGE_MS = 15_000;

const earlyAwareFetch: typeof fetch = (input, init) => {
  try {
    const store = (window as unknown as { __earlyFetch?: Record<string, Early> }).__earlyFetch;
    if (store && typeof input === "string" && (!init?.method || init.method === "GET")) {
      const hit = store[input];
      if (hit) {
        delete store[input];
        const h = new Headers(init?.headers);
        if (Date.now() - hit.t < EARLY_MAX_AGE_MS && h.get("accept") === "application/json" && h.get("authorization") === `Bearer ${anonKey}`) {
          return hit.p.catch(() => fetch(input, init));
        }
      }
    }
  } catch {
    // fall through to a normal request
  }
  return fetch(input, init);
};

// Falls back to a dummy client when env vars are missing so the app can still
// run (auth-gated features show a "not configured" state instead of crashing).
// Fill .env with real values from your Supabase project to activate auth/favorites.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, anonKey!, { global: { fetch: earlyAwareFetch } })
  : createClient("https://placeholder.supabase.co", "placeholder-anon-key");
