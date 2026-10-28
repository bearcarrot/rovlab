import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { proxyUrlFor } from "@/lib/restProxy";
import { isCacheBypassed } from "@/lib/ttlCache";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

const REST_BASE = `${url ?? ""}/rest/v1/`;

// Every other PostgREST call (user data, RPCs, writes) goes out through the same-origin `/sb-rest/*` rewrite in vercel.json, which Vercel
// forwards to Supabase /rest/v1/*. Same origin means the browser sends no CORS preflight, and each preflight was its own API-gateway log
// line (about 40% of all lines). Production builds only; auth/storage/functions/realtime are untouched. If the same-origin request itself
// fails to connect, a GET/HEAD is retried straight against Supabase (never a write, which could already have been applied).
function restFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!import.meta.env.PROD || !input.startsWith(REST_BASE)) return fetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  return fetch(`/sb-rest/${input.slice(REST_BASE.length)}`, init).catch((e) => {
    if (method === "GET" || method === "HEAD") return fetch(input, init);
    throw e;
  });
}

// Public reads of a few shared tables (hero list, stats, tier lists, draft relations, balance changes) go through /api/sb, an edge
// handler whose responses Vercel's CDN keeps for several minutes, so Supabase serves a cache miss instead of every visitor.
// For logged-out visitors (Authorization = anon key) and for signed-in non-admins: every proxied table is `using (true)` for all roles,
// so the rows are the same for everyone. Admins (cache bypass, see useIsAdmin) always go direct so they see their own edits. Production builds only.
// Any problem with the proxy (not deployed, 4xx/5xx, not JSON, network error) falls back to the normal direct request.
function fetchPublic(input: string, init?: RequestInit): Promise<Response> {
  try {
    if (import.meta.env.PROD && (!init?.method || init.method === "GET")) {
      const h = new Headers(init?.headers);
      const auth = h.get("authorization") ?? "";
      if (auth === `Bearer ${anonKey}` || (auth.startsWith("Bearer ") && !isCacheBypassed())) {
        const proxy = proxyUrlFor(input, REST_BASE, h);
        if (proxy) {
          return fetch(proxy, { headers: { Accept: "application/json" }, signal: init?.signal ?? undefined }).then(
            (res) => (res.ok && (res.headers.get("content-type") ?? "").includes("json") ? res : restFetch(input, init)),
            () => restFetch(input, init),
          );
        }
      }
    }
  } catch {
    // fall through to a direct request
  }
  return restFetch(input, init);
}

// คำขอข้อมูลอ้างอิงของหน้าแรกถูกยิงล่วงหน้าจากสคริปต์ใน index.html (window.__earlyFetch) ตั้งแต่ parse HTML
// ที่นี่หยิบผลมาใช้ "ครั้งเดียว" เมื่อ URL ตรงเป๊ะ + เป็น GET + Accept ตรง + ยังไม่ login (Authorization = anon key)
// (index.html ยิงผ่าน /api/sb แต่เก็บผลโดยใช้ URL ตรงของ Supabase เป็น key — ดู fetchPublic ด้านบน)
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
          return hit.p.catch(() => fetchPublic(input, init));
        }
      }
    }
  } catch {
    // fall through to a normal request
  }
  return typeof input === "string" ? fetchPublic(input, init) : fetch(input, init);
};

// Falls back to a dummy client when env vars are missing so the app can still
// run (auth-gated features show a "not configured" state instead of crashing).
// Fill .env with real values from your Supabase project to activate auth/favorites.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, anonKey!, { global: { fetch: earlyAwareFetch } })
  : createClient("https://placeholder.supabase.co", "placeholder-anon-key");
