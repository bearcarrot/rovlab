// กรองผลค้นหา YouTube ให้เหลือเฉพาะวิดีโอที่ยืนยันได้ว่าเกี่ยวกับฮีโร่ตัวนี้ + เป็น RoV
// ไม่มี import ภายนอก เพื่อให้ทดสอบด้วย node ได้ (tests/videos/filter.test.ts) และใช้ใน Deno edge function ได้

export interface YtSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
}

export interface HeroVideo {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string; // เวลาที่ YouTube รายงานว่าวิดีโอเผยแพร่ (ไม่ใช่เวลาที่เราตรวจ)
  thumbnail: string;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

// YouTube ส่ง title เป็น HTML entity (เช่น &#39; &amp;)
export const decodeEntities = (s: string) =>
  s.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isLatin = (s: string) => /^[\x20-\x7E]+$/.test(s);
// ’ ‘ ` → ' เพื่อให้ "Kil'Groth" จับได้ทั้งแบบพิมพ์ตรงและโค้งงอ
const norm = (s: string) => s.toLowerCase().replace(/[’‘`]/g, "'");

const ROV_MARKER = /(?<![a-z0-9])(rov|aov|arena of valor)(?![a-z0-9])/i;

/** ชื่อฮีโร่ปรากฏเป็นคำเต็มใน title (อังกฤษ = ขอบเขตคำ, ไทย = มีข้อความนั้น); ชื่อสั้นกว่า 3 ตัวไม่ใช้ (กำกวมเกินไป) */
export function titleMentionsHero(title: string, names: string[]): boolean {
  const t = norm(title);
  return names.some((raw) => {
    const n = norm(raw.trim());
    if (n.length < 3) return false;
    return isLatin(n) ? new RegExp(`(?<![a-z0-9])${escapeRe(n)}(?![a-z0-9])`).test(t) : t.includes(n);
  });
}

/**
 * เก็บเฉพาะวิดีโอที่: มี id, ไม่ใช่ไลฟ์ที่ยังไม่เริ่ม, title ระบุชื่อฮีโร่, และ title/คำอธิบายระบุว่าเป็น RoV/AoV
 * ตัดซ้ำตาม id เรียงใหม่สุดก่อนตามเวลาเผยแพร่จริงจาก YouTube แล้วตัดเหลือ limit
 * ไม่มีชื่อฮีโร่ที่ใช้ตรวจได้เลย = ไม่คืนอะไร (ยืนยันความเกี่ยวข้องไม่ได้)
 */
export function pickVideos(items: YtSearchItem[], heroNames: string[], limit = 6): HeroVideo[] {
  const seen = new Set<string>();
  const out: HeroVideo[] = [];
  for (const it of items) {
    const id = it.id?.videoId;
    const sn = it.snippet;
    if (!id || !sn || seen.has(id)) continue;
    if (sn.liveBroadcastContent === "upcoming") continue;
    const title = decodeEntities(sn.title ?? "").trim();
    const publishedAt = sn.publishedAt ?? "";
    if (!title || Number.isNaN(Date.parse(publishedAt))) continue;
    if (!titleMentionsHero(title, heroNames)) continue;
    if (!ROV_MARKER.test(`${title}\n${decodeEntities(sn.description ?? "")}`)) continue;
    const th = sn.thumbnails;
    const thumbnail = th?.medium?.url ?? th?.high?.url ?? th?.default?.url ?? "";
    if (!thumbnail.startsWith("https://")) continue;
    seen.add(id);
    out.push({
      id,
      title,
      channel: decodeEntities(sn.channelTitle ?? "").trim(),
      channelId: sn.channelId ?? "",
      publishedAt,
      thumbnail,
    });
  }
  out.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return out.slice(0, limit);
}
