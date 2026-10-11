// Edge handler for social preview images: /api/share-image?kind=draft&id=<shareId>&v=<version>
// `v` only busts platform/CDN caches (it is not used for lookup). Invalid or unpublished ids redirect to the default site logo.

import { SITE } from "./_share/html";
import { renderDraftImage } from "./_share/draftImage";

export const config = { runtime: "edge" };

const fallback = (cache: string): Response =>
  new Response(null, { status: 302, headers: { location: `${SITE}/logo.png`, "cache-control": cache } });

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id") ?? "";
  if (kind !== "draft") return fallback("public, s-maxage=3600");
  try {
    return (await renderDraftImage(id)) ?? fallback("public, s-maxage=60");
  } catch {
    return fallback("no-store"); // preview generation must never surface as a broken page
  }
}
