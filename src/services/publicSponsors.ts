// Public sponsor list for the Home page. Served by /api/public-sponsors (CDN-cached ~1h, see api/public-sponsors.ts); the browser never
// queries Supabase for it. One request per page load shared by every caller; any failure yields an empty list (no sponsors block).

export interface PublicSponsor {
  id: string;
  name: string;
  tagline: string;
  logo_url: string | null;
  link_url: string;
}

const ENDPOINT = "/api/public-sponsors";
const MAX_SPONSORS = 6;
const HTTPS = /^https:\/\/[^\s"'<>\\]{1,2040}$/;
const LOGO = /^https:\/\/assets\.rovlab\.app\/[^\s"'<>\\?#]{1,500}\.(?:jpe?g|png|webp)$/i;

// The server already validated; this is a second, cheap check because the values end up in href/src attributes.
export function parseSponsorsResponse(v: unknown): PublicSponsor[] {
  const list = (v as { sponsors?: unknown } | null)?.sponsors;
  if (!Array.isArray(list)) return [];
  const out: PublicSponsor[] = [];
  for (const r of list) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string" || o.id === "") continue;
    if (typeof o.name !== "string" || o.name.trim() === "") continue;
    if (typeof o.link_url !== "string" || !HTTPS.test(o.link_url)) continue;
    out.push({
      id: o.id,
      name: o.name,
      tagline: typeof o.tagline === "string" ? o.tagline : "",
      logo_url: typeof o.logo_url === "string" && LOGO.test(o.logo_url) ? o.logo_url : null,
      link_url: o.link_url,
    });
    if (out.length >= MAX_SPONSORS) break;
  }
  return out;
}

let pending: Promise<PublicSponsor[]> | null = null;

export function getPublicSponsors(): Promise<PublicSponsor[]> {
  if (!pending) {
    pending = fetch(ENDPOINT, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(parseSponsorsResponse)
      .catch(() => [] as PublicSponsor[]);
  }
  return pending;
}

export function __resetPublicSponsorsForTests(): void {
  pending = null;
}
