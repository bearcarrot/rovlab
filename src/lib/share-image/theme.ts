import { ASSETS_BASE } from "../siteConfig";

// ค่าสีตรงกับ tailwind.config.ts (colors.*) — แก้ที่นั่นแล้วต้องแก้ที่นี่ด้วย เพราะ Canvas อ่านคลาส Tailwind ไม่ได้
export const COLORS = {
  bg: "#0A0B0E",
  surface: "#14161B",
  raised: "#1C1F26",
  border: "#262A33",
  text: "#F2F3F5",
  muted: "#8B909B",
  faint: "#5C616D",
  accent: "#E8A33D",
  accentFg: "#0A0B0E",
  rift: "#4C8DFF",
  win: "#3DD68C",
  loss: "#E5484D",
} as const;

// ตัวอักษรป้าย Tier เป็นสีขาวทุกระดับ (ให้ตรงกับ components/ui/badge.tsx)
export const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  "S+": { bg: "#DC2626", fg: "#FFFFFF" },
  S: { bg: "#F97316", fg: "#FFFFFF" },
  A: { bg: "#EAB308", fg: "#FFFFFF" },
  B: { bg: "#22C55E", fg: "#FFFFFF" },
  C: { bg: "#3B82F6", fg: "#FFFFFF" },
};

// ชื่อฟอนต์ตรงกับ index.html (Google Fonts) และ tailwind fontFamily
export const FONT_DISPLAY = '"Kanit", "IBM Plex Sans Thai", sans-serif';
export const FONT_BODY = '"IBM Plex Sans Thai", "Inter", sans-serif';

export const SITE_LABEL = "RoV LAB";
export const SITE_URL = "rovlab.app";
// โลโก้เต็ม (แนวกว้าง) โฮสต์บน R2 (ASSETS_BASE/v1/) — วาดลง Canvas แล้ว export ได้เพราะ R2 ตั้ง CORS ให้ origin ของเว็บ
// และ assets.ts โหลดด้วย crossOrigin="anonymous" ถ้าโหลดไม่ได้ drawLogo จะวาดข้อความ "RoV LAB" แทน
// ไฟล์เดิมใน public/v1/ ยังอยู่ เพื่อใช้ rollback (ตั้ง ASSETS_BASE เป็น "" ใน lib/siteConfig.ts)
export const LOGO_URL = `${ASSETS_BASE}/v1/logo-share.png`;
export const DISCLAIMER_TH = "ไม่ใช่ผลิตภัณฑ์อย่างเป็นทางการของเกม";
export const CREDIT_TH = "ชื่อและไอคอนฮีโร่เป็นลิขสิทธิ์ของเจ้าของเกม · RoV LAB เป็นโปรเจกต์ชุมชนอิสระ";
