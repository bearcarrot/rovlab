// Site-wide constants used by the footer and legal pages.
// Brand name lives here so it can be changed in one place.
export const SITE = {
  name: "RoV LAB",
  taglineTh: "เครื่องมือและข้อมูลชุมชนสำหรับผู้เล่น RoV",
  taglineEn: "Community tools & data for RoV players",
  // First year of the project; the footer shows a range once the year passes.
  startYear: 2026,
} as const;

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
