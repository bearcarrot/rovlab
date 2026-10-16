// Edge handler behind /heroes/:slug (see vercel.json). Vercel serves the prerendered dist/heroes/<slug>/index.html first,
// so this only runs for slugs with no static file: unknown slug -> real HTTP 404 + noindex (the SPA still shows its own
// "ไม่พบฮีโร่นี้" state); a real hero missed by the last build -> 200 with correct head tags. Same pattern as api/share-meta.ts.

import { injectMeta, markNoindex, SITE } from "./_share/html";
import { restSelect } from "./_share/supabase";

export const config = { runtime: "edge" };

const CACHE_OK = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
const CACHE_MISSING = "public, max-age=0, s-maxage=60, stale-while-revalidate=120";
const CACHE_ERROR = "public, max-age=0, s-maxage=10";
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/i; // also keeps the PostgREST filter below injection-free

async function loadTemplate(origin: string): Promise<string | null> {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(`${origin}/index.html`);
      if (res.ok) {
        const text = await res.text();
        if (text.includes("</head>")) return text;
      }
    } catch {
      // retry once
    }
  }
  return null;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? url.pathname.match(/^\/heroes\/([^/]+)\/?$/)?.[1] ?? "";
  const [template, rows] = await Promise.all([
    loadTemplate(url.origin),
    SLUG.test(slug) ? restSelect<{ slug: string; name: string }>("heroes", `select=slug,name&slug=eq.${slug}&limit=1`) : Promise.resolve([]),
  ]);
  if (!template) return new Response("Service temporarily unavailable", { status: 503, headers: { "cache-control": "no-store" } });

  let html: string;
  let status = 200;
  let cache = CACHE_OK;
  const hero = rows?.[0];
  if (hero) {
    // title/description must match HeroDetail.tsx (seoName = English name)
    html = injectMeta(template, {
      title: `${hero.name} — รายละเอียดฮีโร่ RoV สถิติ สกิล คู่แพ้ทาง | RoV LAB`,
      description: `รายละเอียดฮีโร่ ${hero.name} ใน RoV: สถิติ Win/Pick/Ban Rate, สกิล, จุดแข็ง-จุดอ่อน และฮีโร่ที่ชนะทาง/แพ้ทาง`,
      url: `${SITE}/heroes/${hero.slug}`,
      image: { url: `${SITE}/v1/og-image.png`, alt: "RoV LAB" },
      type: "website",
      marker: `/heroes/${hero.slug}`,
    });
  } else {
    html = markNoindex(template);
    if (rows === null) cache = CACHE_ERROR; // backend unreachable: can't tell, so keep 200 but don't let it be indexed
    else {
      status = 404;
      cache = CACHE_MISSING;
    }
  }

  return new Response(request.method === "HEAD" ? null : html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache },
  });
}
