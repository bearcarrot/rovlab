// Shared building blocks for the social-card renderers (Draft, Tier List, ...). Rendered with @vercel/og (satori) on the edge.
// Every external dependency (font, hero icons) is optional: if it fails the card still renders.

import { SITE } from "./html";

export const GOLD = "#E8A33D";
export const BLUE = "#4C8DFF";
export const MUTED = "#8B909B";
export const SLUG = /^[A-Za-z0-9_-]{1,64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export interface HeroRow {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
}

export type El = { type: string; props: Record<string, unknown> };
// Plain element objects (satori accepts them) so these files need no JSX transform.
export const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): El => ({
  type,
  props: { ...extra, style, children: Array.isArray(children) ? children.filter(Boolean) : children },
});

async function timedFetch(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Thai-capable font, subset to the characters actually used (Google Fonts returns TTF when no browser UA is sent). */
export async function loadFont(text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(Array.from(`${text}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 `))].join("");
  const css = await timedFetch(`https://fonts.googleapis.com/css2?family=Kanit:wght@700&text=${encodeURIComponent(chars)}`, 3000);
  if (!css) return null;
  const m = (await css.text()).match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!m) return null;
  const font = await timedFetch(m[1], 3000);
  return font ? font.arrayBuffer() : null;
}

function sniffMime(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  return null; // e.g. WebP / AVIF: satori cannot draw them
}

function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Fetch an image and return it as a data URI, only if satori can draw it (PNG / JPEG / GIF). */
async function loadImage(url: string): Promise<string | null> {
  const res = await timedFetch(url, 2500);
  if (!res) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 600_000) return null;
  const mime = sniffMime(bytes);
  return mime ? `data:${mime};base64,${toBase64(bytes)}` : null;
}

export async function iconDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  const abs = /^https?:\/\//i.test(url) ? url : url.startsWith("//") ? `https:${url}` : url.startsWith("/") ? `${SITE}${url}` : null;
  if (!abs) return null;
  const direct = await loadImage(abs);
  if (direct) return direct;
  // Icon is WebP/AVIF (satori cannot draw those): ask a public image proxy for a 128px PNG of the same public icon.
  return loadImage(`https://wsrv.nl/?url=${encodeURIComponent(abs)}&w=128&h=128&fit=cover&output=png`);
}

/** Square hero tile: icon when it could be loaded, otherwise the first two letters of the hero name. */
export function heroTile(o: {
  size: number;
  filled: boolean;
  name: string | null;
  icon: string | null;
  color: string;
  border: number;
  radius: number;
  fontSize: number;
}): El {
  const box = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: o.size,
    height: o.size,
    borderRadius: o.radius,
    background: "#1C1F26",
    border: `${o.border}px solid ${o.filled ? o.color : "#262A33"}`,
    overflow: "hidden",
  };
  const inner = o.size - o.border * 2;
  if (o.icon) {
    return el("div", box, el("img", { width: inner, height: inner, objectFit: "cover" }, undefined, { src: o.icon, width: inner, height: inner }));
  }
  const initials = o.filled && o.name ? Array.from(o.name).slice(0, 2).join("").toUpperCase() : "";
  return el("div", { ...box, fontSize: o.fontSize, color: MUTED }, initials || " ");
}

export const badge = (text: string, strong: boolean): El =>
  el(
    "div",
    {
      display: "flex",
      fontSize: 22,
      padding: "6px 18px",
      borderRadius: 999,
      color: strong ? "#0A0B0E" : GOLD,
      background: strong ? GOLD : "transparent",
      border: `2px solid ${GOLD}`,
    },
    text
  );
