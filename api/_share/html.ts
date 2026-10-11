// Metadata injection into the built index.html (the same template the SPA uses).
// The HTML is identical for people and crawlers except for the <head> tags, so normal visitors still boot the React app.

export const SITE = "https://rovlab.vercel.app";
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface ShareHtmlMeta {
  title: string;
  description: string;
  /** canonical + og:url */
  url: string;
  image: { url: string; alt: string };
  /** og:type, default "article" */
  type?: string;
  /** Path the metadata was generated for (e.g. /draft/<id as requested>). RouteMeta skips its client-side override when it matches. */
  marker: string;
}

type Attr = "name" | "property";

function setTag(html: string, attr: Attr, key: string, value: string): string {
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`);
  return re.test(html) ? html.replace(re, () => tag) : html.replace("</head>", () => `    ${tag}\n  </head>`);
}

export function injectMeta(html: string, m: ShareHtmlMeta): string {
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(m.title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_x, a: string, b: string) => a + esc(m.url) + b);
  const tags: Array<[Attr, string, string]> = [
    ["name", "description", m.description],
    ["property", "og:type", m.type ?? "article"],
    ["property", "og:title", m.title],
    ["property", "og:description", m.description],
    ["property", "og:url", m.url],
    ["property", "og:image", m.image.url],
    ["property", "og:image:width", String(OG_WIDTH)],
    ["property", "og:image:height", String(OG_HEIGHT)],
    ["property", "og:image:alt", m.image.alt],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", m.title],
    ["name", "twitter:description", m.description],
    ["name", "twitter:image", m.image.url],
    ["name", "twitter:image:alt", m.image.alt],
    ["name", "share-meta", m.marker],
  ];
  return tags.reduce((h, [attr, key, value]) => setTag(h, attr, key, value), out);
}

/** Missing / invalid / unpublished item: keep the default site metadata, just don't let search engines index the URL. */
export function markNoindex(html: string): string {
  return setTag(html, "name", "robots", "noindex");
}
