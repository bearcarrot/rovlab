// Site-wide constants used by the footer and legal pages.
// Brand name lives here so it can be changed in one place.
export const SITE = {
  name: "RoV LAB",
  // Same voice as the Home eyebrow ("BETTER TOOLS, BETTER WINS") and h1.
  taglineTh: "เครื่องมือดี มีชัยไปกว่าครึ่ง",
  taglineEn: "Better Tools, Better Wins",
  // First year of the project; the footer shows a range once the year passes.
  startYear: 2026,
  // Public contact address for privacy / takedown requests. The legal pages and
  // /contact hide their email line while it's empty.
  contactEmail: "contact.rovlab@gmail.com" as string,
} as const;

// รูปแบรนด์โฮสต์บน Cloudflare R2 (custom domain) — path ต้องตรงกับ public/v1/ เดิม (v1/<ชื่อไฟล์>)
// ไฟล์เดิมใน public/v1/ ยังอยู่เพื่อ rollback: เปลี่ยน ASSETS_BASE กลับเป็น "" ก็ใช้ same-origin ได้ทันที
export const ASSETS_BASE = "https://assets.rovlab.app";
export const LOGO_64_URL = `${ASSETS_BASE}/v1/logo-64.webp`;

// Official Ko-fi page for voluntary donations (Home support block). Set to "" to hide the Ko-fi block.
export const KOFI_URL = "https://ko-fi.com/rovlab" as string;

// Date the legal pages were last revised (update when the text changes).
export const LEGAL_UPDATED = "2026-10-23";

export interface FooterLink {
  to: string;
  label: string;
}

// Policy / legal routes (see src/pages/Legal.tsx) plus the contact page.
export const LEGAL_LINKS: FooterLink[] = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Use" },
  { to: "/disclaimer", label: "Disclaimer" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/community-guidelines", label: "Community Guidelines" },
  { to: "/contact", label: "Contact" },
];

export type SocialId = "facebook" | "instagram" | "tiktok";

export interface SocialLink {
  id: SocialId; // matches the brand glyph ids in features/profile/ContactAppIcon
  label: string;
  href: string;
}

// Official RoV LAB channels. The only place these URLs live — Footer and Data Sources both read this list.
export const SOCIAL_LINKS: SocialLink[] = [
  { id: "facebook", label: "Facebook", href: "https://fb.com/rovlab" },
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/rovlab.app/" },
  { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@rovlab.app" },
];

export function copyrightYears(now: Date = new Date()): string {
  const y = now.getFullYear();
  return y > SITE.startYear ? `${SITE.startYear}–${y}` : String(SITE.startYear);
}
