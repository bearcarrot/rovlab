// Edge handler behind /draft/:shareId and /tier-list/:shareId (see vercel.json). Returns the SPA's own index.html with
// item-specific <head> metadata, so crawlers (Facebook, LINE, Discord, X, ...) see the right title / description / image
// WITHOUT running JavaScript, while normal visitors get the same HTML and boot the React app as before.
// Any failure (bad id, unpublished, backend down) falls back to the unchanged default metadata; the SPA shows its own not-found state.

import { injectMeta, markNoindex } from "./_share/html";
import { isShareKind, resolveShare, SHARE_PATH, type ShareLookup } from "./_share/resolvers";

export const config = { runtime: "edge" };

const CACHE_OK = "public, max-age=0, s-maxage=300, stale-while-revalidate=600"; // a republished item shows up within ~5 min
const CACHE_MISSING = "public, max-age=0, s-maxage=60, stale-while-revalidate=120";
const CACHE_ERROR = "public, max-age=0, s-maxage=10";

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

// kind/id come from the rewrite's query string; the pathname is a fallback in case the platform does not forward it.
function parseTarget(url: URL): { kind: string; id: string } {
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  if (kind && id) return { kind, id };
  const m = url.pathname.match(/^\/(draft|tier-list)\/([^/]+)\/?$/);
  if (!m) return { kind: "", id: "" };
  try {
    return { kind: m[1], id: decodeURIComponent(m[2]) };
  } catch {
    return { kind: "", id: "" };
  }
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { kind, id } = parseTarget(url);
  const missing: ShareLookup = { status: "missing" };
  const [template, lookup] = await Promise.all([loadTemplate(url.origin), isShareKind(kind) ? resolveShare(kind, id) : Promise.resolve(missing)]);

  if (!template) {
    return new Response("Service temporarily unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }

  let html: string;
  let cache: string;
  if (lookup.status === "ok" && isShareKind(kind)) {
    html = injectMeta(template, { ...lookup.meta, marker: `${SHARE_PATH[kind]}/${id}` });
    cache = CACHE_OK;
  } else {
    html = markNoindex(template);
    cache = lookup.status === "error" ? CACHE_ERROR : CACHE_MISSING;
  }

  return new Response(request.method === "HEAD" ? null : html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache },
  });
}
