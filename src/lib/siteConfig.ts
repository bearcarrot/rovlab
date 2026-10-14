// Site-wide constants used by the footer and legal pages.
// Brand name lives here so it can be changed in one place.
export const SITE = {
  name: "RoV LAB",
  // Same voice as the Home eyebrow ("BETTER TOOLS, BETTER WINS") and h1.
  taglineTh: "เครื่องมือดี มีชัยไปกว่าครึ่ง",
  taglineEn: "Better Tools, Better Wins",
  // First year of the project; the footer shows a range once the year passes.
  startYear: 2026,
  // Public contact address for privacy / takedown requests. Footer and legal
  // pages hide their contact UI while it's empty.
  contactEmail: "contact.rovlab@gmail.com" as string,
} as const;

// Date the legal pages were last revised (update when the text changes).
export const LEGAL_UPDATED = "2026-10-14";

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
