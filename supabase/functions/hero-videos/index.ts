import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pickVideos, type HeroVideo, type YtSearchItem } from "./filter.ts";

// วิดีโอแนะนำล่าสุดต่อฮีโร่จาก YouTube Data API (ฝั่งเซิร์ฟเวอร์เท่านั้น)
// Secrets: YOUTUBE_API_KEY (จำเป็น), YOUTUBE_CACHE_TTL_HOURS (ไม่บังคับ, ค่าเริ่มต้น 24)
// แคชในตาราง hero_video_cache (migration 20261013) ลบแถวเพื่อบังคับรีเฟรชได้โดยไม่ต้อง deploy

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  // ให้เบราว์เซอร์จำผล preflight (ไม่ใส่ = 5 วินาที ทำให้ทุกการเรียกกลายเป็น OPTIONS + POST สองครั้งของฟังก์ชัน); Chrome จำกัดที่ 2 ชม., Firefox 24 ชม.
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DEFAULT_TTL_HOURS = 24;
const COOLDOWN_MS = 30 * 60 * 1000; // หลัง quota เต็ม/key ใช้ไม่ได้ ไม่ยิงซ้ำถี่ๆ (ต่อ instance)
let cooldownUntil = 0;
const inflight = new Map<string, Promise<Result>>(); // ฮีโร่เดียวกันที่แคชหมดพร้อมกัน ยิง YouTube ครั้งเดียว

type Cached = { videos: HeroVideo[]; fetchedAt: string };
type Result = { status: "ok"; videos: HeroVideo[]; fetchedAt: string; stale: boolean } | { status: "not_configured" | "unavailable" };

const ttlMs = () => {
  const h = Number(Deno.env.get("YOUTUBE_CACHE_TTL_HOURS"));
  return (h > 0 ? h : DEFAULT_TTL_HOURS) * 3600 * 1000;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let slug: unknown;
  try {
    ({ slug } = await req.json());
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return json({ error: "invalid slug" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  // ใช้ anon + JWT ผู้เรียกอ่านฮีโร่ (ตามสิทธิ์ปกติ); รับเฉพาะ slug ที่มีจริง จึงยิง YouTube ได้ไม่เกินจำนวนฮีโร่ต่อรอบแคช
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: hero } = await sb.from("heroes").select("id, name, name_th").eq("slug", slug).maybeSingle();
  if (!hero) return json({ error: "hero not found" }, 404);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await admin.from("hero_video_cache").select("videos, fetched_at").eq("hero_id", hero.id).maybeSingle();
  const cached: Cached | null = row ? { videos: row.videos as HeroVideo[], fetchedAt: row.fetched_at as string } : null;

  if (cached && Date.now() - Date.parse(cached.fetchedAt) < ttlMs()) return json({ status: "ok", ...cached, stale: false });

  // แคชหมดอายุ/ยังไม่มี: ถ้ายิง YouTube ไม่ได้ให้ใช้ของเก่า (stale) ดีกว่าหน้าว่าง
  const fallback = (status: "not_configured" | "unavailable"): Result =>
    cached ? { status: "ok", ...cached, stale: true } : { status };

  let p = inflight.get(hero.id);
  if (!p) {
    p = refresh(hero, cached, admin, fallback).finally(() => inflight.delete(hero.id));
    inflight.set(hero.id, p);
  }
  return json(await p);
});

async function refresh(
  hero: { id: string; name: string; name_th: string | null },
  old: Cached | null,
  // deno-lint-ignore no-explicit-any
  admin: { from: (t: string) => any },
  fallback: (s: "not_configured" | "unavailable") => Result,
): Promise<Result> {
  const key = Deno.env.get("YOUTUBE_API_KEY")?.trim();
  if (!key) return fallback("not_configured");
  if (Date.now() < cooldownUntil) return fallback("unavailable");

  const query = `${hero.name} ROV`;
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    order: "date",
    maxResults: "50",
    q: query,
    relevanceLanguage: "th",
    regionCode: "TH",
  });
  let res: Response;
  try {
    // key ส่งผ่าน header ไม่ใส่ใน URL เพื่อไม่ให้หลุดลง log
    res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { headers: { "x-goog-api-key": key } });
  } catch (e) {
    console.error("hero-videos fetch failed", e instanceof Error ? e.message : "unknown");
    return fallback("unavailable");
  }
  if (!res.ok) {
    let reason = "";
    try {
      reason = (await res.json())?.error?.errors?.[0]?.reason ?? "";
    } catch { /* not json */ }
    console.error("hero-videos YouTube error", res.status, reason);
    cooldownUntil = Date.now() + COOLDOWN_MS; // quota (403 quotaExceeded) หรือ key/คำขอผิด: อย่ายิงซ้ำทันที
    return fallback("unavailable");
  }

  const data = await res.json();
  const videos = pickVideos((data.items ?? []) as YtSearchItem[], [hero.name, hero.name_th ?? ""]);
  const fetchedAt = new Date().toISOString();
  // ผลว่างก็แคช (ไม่เผาโควต้าซ้ำ) แต่ไม่ทับของเก่าที่มีวิดีโอ ถ้าครั้งนี้กรองแล้วไม่เหลือเลย
  const keepOld = videos.length === 0 && old && old.videos.length > 0;
  const { error } = await admin
    .from("hero_video_cache")
    .upsert({ hero_id: hero.id, query, videos: keepOld ? old!.videos : videos, fetched_at: fetchedAt });
  if (error) console.error("hero-videos cache write failed", error.message);
  return { status: "ok", videos: keepOld ? old!.videos : videos, fetchedAt, stale: false };
}
