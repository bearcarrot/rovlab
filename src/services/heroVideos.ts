import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached } from "@/lib/ttlCache";

// วิดีโอแนะนำล่าสุดต่อฮีโร่ — ค้นหา/กรอง/แคชทั้งหมดอยู่ใน Edge Function hero-videos (YouTube API key ไม่อยู่ฝั่ง client)
export interface HeroVideo {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string; // เวลาเผยแพร่จริงของวิดีโอ (จาก YouTube)
  thumbnail: string;
}

export type HeroVideosResult =
  | { status: "ok"; videos: HeroVideo[]; fetchedAt: string; stale: boolean } // fetchedAt = เวลาที่ระบบเราตรวจกับ YouTube ล่าสุด
  | { status: "not_configured" | "unavailable" };

const CLIENT_TTL_MS = 10 * 60 * 1000;

async function load(slug: string): Promise<HeroVideosResult> {
  const { data, error } = await supabase.functions.invoke("hero-videos", { body: { slug } });
  if (error) {
    // functions.invoke ซ่อนข้อความจริงไว้ใน error.context (Response) — เหมือน services/ai.ts
    const res = (error as { context?: unknown }).context;
    if (res instanceof Response) {
      const body = await res.json().catch(() => null);
      if (body?.error) throw new Error(String(body.error));
    }
    throw error;
  }
  return data as HeroVideosResult;
}

// แคชฝั่ง client เฉพาะผลที่ได้วิดีโอจริง (not_configured/unavailable ลองใหม่ได้เรื่อยๆ ไม่ติดแคช)
export function getHeroVideos(slug: string): Promise<HeroVideosResult> {
  if (!isSupabaseConfigured) return Promise.resolve({ status: "not_configured" });
  return cached(`videos:${slug}`, CLIENT_TTL_MS, () => load(slug), (v) => v.status === "ok");
}
