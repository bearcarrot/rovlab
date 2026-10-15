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

// ตัวอักษรป้าย Tier เป็นสีเข้ม accentFg ทุกระดับ (ให้ตรงกับ components/ui/badge.tsx) — คอนทราสต์ผ่าน WCAG AA 4.5:1
export const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  "S+": { bg: "#EF4444", fg: COLORS.accentFg },
  S: { bg: "#F97316", fg: COLORS.accentFg },
  A: { bg: "#EAB308", fg: COLORS.accentFg },
  B: { bg: "#22C55E", fg: COLORS.accentFg },
  C: { bg: "#3B82F6", fg: COLORS.accentFg },
};

// ชื่อฟอนต์ตรงกับ index.html (Google Fonts) และ tailwind fontFamily
export const FONT_DISPLAY = '"Kanit", "IBM Plex Sans Thai", sans-serif';
export const FONT_BODY = '"IBM Plex Sans Thai", "Inter", sans-serif';

export const SITE_LABEL = "RoV LAB";
export const SITE_URL = "rovlab.vercel.app";
// โลโก้เต็ม (แนวกว้าง) อยู่ใน public/v1/ (same-origin) จึงวาดลง Canvas แล้ว export ได้โดยไม่ติด CORS
// ไฟล์เดิม /logo.png ยังอยู่ใน public/ เพื่อใช้ rollback
export const LOGO_URL = "/v1/logo-share.png";
export const DISCLAIMER_TH = "ไม่ใช่ผลิตภัณฑ์อย่างเป็นทางการของเกม";
export const CREDIT_TH = "ชื่อและไอคอนฮีโร่เป็นลิขสิทธิ์ของเจ้าของเกม · RoV LAB เป็นโปรเจกต์ชุมชนอิสระ";
