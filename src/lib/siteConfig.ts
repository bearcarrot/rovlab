// Site-wide constants used by the footer and legal pages.
// Brand name lives here so it can be changed in one place.
export const SITE = {
  name: "RoV LAB",
  // Same voice as the Home eyebrow ("RoV META & DRAFT INTELLIGENCE").
  taglineTh: "ข้อมูลเมต้าและเครื่องมือดราฟต์สำหรับผู้เล่น RoV",
  taglineEn: "Meta & Draft Intelligence for RoV Players",
  // First year of the project; the footer shows a range once the year passes.
  startYear: 2026,
  // Public contact address for privacy / takedown requests. Leave empty until a
  // real address exists — legal pages hide the contact section while it's empty.
  contactEmail: "" as string,
} as const;

// Date the legal pages were last revised (update when the text changes).
export const LEGAL_UPDATED = "2026-10-10";

export interface FooterLink {
  to: string;
  label: string;
}

// Policy / legal routes (see src/pages/Legal.tsx).
export const LEGAL_LINKS: FooterLink[] = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Use" },
  { to: "/disclaimer", label: "Disclaimer" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/community-guidelines", label: "Community Guidelines" },
];

export function copyrightYears(now: Date = new Date()): string {
  const y = now.getFullYear();
  return y > SITE.startYear ? `${SITE.startYear}–${y}` : String(SITE.startYear);
}
