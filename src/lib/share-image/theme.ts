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
  "S+": { bg: "#EF4444", fg: "#FFFFFF" },
  S: { bg: "#F97316", fg: "#FFFFFF" },
  A: { bg: "#EAB308", fg: "#FFFFFF" },
  B: { bg: "#22C55E", fg: "#FFFFFF" },
  C: { bg: "#3B82F6", fg: "#FFFFFF" },
};

// ชื่อฟอนต์ตรงกับ index.html (Google Fonts) และ tailwind fontFamily
export const FONT_DISPLAY = '"Kanit", "IBM Plex Sans Thai", sans-serif';
export const FONT_BODY = '"IBM Plex Sans Thai", "Inter", sans-serif';

export const SITE_LABEL = "RovLab";
export const SITE_URL = "rovlab.vercel.app";
// โลโก้อยู่ใน public/ (same-origin) จึงวาดลง Canvas แล้ว export ได้โดยไม่ติด CORS
export const LOGO_URL = "/logo.png";
export const DISCLAIMER_TH = "ไม่ใช่ผลิตภัณฑ์อย่างเป็นทางการของเกม";
export const CREDIT_TH = "ชื่อและไอคอนฮีโร่เป็นลิขสิทธิ์ของเจ้าของเกม · RovLab เป็นโปรเจกต์ชุมชนอิสระ";
