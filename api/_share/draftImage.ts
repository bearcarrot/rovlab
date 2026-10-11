// 1200x630 social card for a Community Draft. Rendered with @vercel/og (satori) on the edge.
// Shows: brand, title, format / Global Ban-Pick badges, and Game 1 picks for both teams (hero icons).
// Every external dependency (font, hero icons) is optional: if it fails the card still renders.

import { ImageResponse } from "@vercel/og";
import { parseSeries, TEAM_SIZE } from "../../src/features/draft/series";
import { shortIdToUuid } from "../../src/features/share/shareId";
import { OG_HEIGHT, OG_WIDTH, SITE } from "./html";
import { restSelect } from "./supabase";

const GOLD = "#E8A33D";
const BLUE = "#4C8DFF";
const MUTED = "#8B909B";
const SLUG = /^[A-Za-z0-9_-]{1,64}$/;
const ICON = 88;

interface DraftRow {
  title: string;
  format: string;
  global_ban_pick: boolean;
  series: unknown;
}
interface HeroRow {
  slug: string;
  name: string;
  icon_url: string | null;
}

type El = { type: string; props: Record<string, unknown> };
// Plain element objects (satori accepts them) so this file needs no JSX transform.
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): El => ({
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
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  const css = await timedFetch(`https://fonts.googleapis.com/css2?family=Kanit:wght@700&text=${encodeURIComponent(text)}`, 3000);
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
  return null; // e.g. WebP: satori cannot draw it, so the tile falls back to initials
}

function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

async function iconDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  const abs = /^https?:\/\//i.test(url) ? url : url.startsWith("//") ? `https:${url}` : url.startsWith("/") ? `${SITE}${url}` : null;
  if (!abs) return null;
  const res = await timedFetch(abs, 2500);
  if (!res) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 600_000) return null;
  const mime = sniffMime(bytes);
  return mime ? `data:${mime};base64,${toBase64(bytes)}` : null;
}

function tile(slug: string | null, hero: HeroRow | undefined, icon: string | null, color: string): El {
  const box = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: ICON,
    height: ICON,
    borderRadius: 14,
    background: "#1C1F26",
    border: `3px solid ${slug ? color : "#262A33"}`,
    overflow: "hidden",
  };
  if (icon) {
    return el("div", box, el("img", { width: ICON - 6, height: ICON - 6, objectFit: "cover" }, undefined, { src: icon, width: ICON - 6, height: ICON - 6 }));
  }
  const initials = slug ? Array.from(hero?.name ?? slug).slice(0, 2).join("").toUpperCase() : "";
  return el("div", { ...box, fontSize: 28, color: MUTED }, initials || " ");
}

function team(label: string, color: string, slugs: (string | null)[], heroes: Map<string, HeroRow>, icons: Map<string, string | null>): El {
  return el("div", { display: "flex", flexDirection: "column", gap: 12 }, [
    el("div", { display: "flex", fontSize: 20, color, letterSpacing: 2 }, label),
    el(
      "div",
      { display: "flex", gap: 10 },
      slugs.map((s) => tile(s, s ? heroes.get(s) : undefined, s ? icons.get(s) ?? null : null, color))
    ),
  ]);
}

const badge = (text: string, strong: boolean): El =>
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

const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/** Returns null when the Draft is invalid / unpublished; throws when the backend is unreachable. */
export async function renderDraftImage(rawId: string): Promise<Response | null> {
  const uuid = shortIdToUuid(rawId);
  if (!uuid) return null;
  const rows = await restSelect<DraftRow>("community_drafts", `select=title,format,global_ban_pick,series&id=eq.${uuid}&limit=1`);
  if (rows === null) throw new Error("draft lookup failed");
  const row = rows[0];
  if (!row) return null;

  const series = parseSeries(row.series);
  const game = series?.games[0];
  const mine = game?.mine.picks ?? Array<string | null>(TEAM_SIZE).fill(null);
  const enemy = game?.enemy.picks ?? Array<string | null>(TEAM_SIZE).fill(null);
  const slugs = [...new Set([...mine, ...enemy].filter((s): s is string => !!s && SLUG.test(s)))];

  const gameCount = series?.games.length ?? 1;
  const title = Array.from(row.title.trim()).slice(0, 56).join("");
  const fmt = row.format === "single" ? "SINGLE" : row.format.toUpperCase();
  const labels = "YOUR TEAM ENEMY RoV LAB DRAFT ASSISTANT GLOBAL BAN/PICK SINGLE GAME GAMES VS BO3 BO5 BO7 0123456789 · ";
  const fontText = [...new Set(Array.from(`${title}${labels}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`))].join("");

  const [heroRows, font] = await Promise.all([
    slugs.length ? restSelect<HeroRow>("heroes", `select=slug,name,icon_url&slug=in.(${slugs.join(",")})`) : Promise.resolve([] as HeroRow[]),
    loadFont(fontText),
  ]);
  const heroes = new Map((heroRows ?? []).map((h) => [h.slug, h]));
  const iconPairs = await Promise.all(slugs.map(async (s) => [s, await iconDataUri(heroes.get(s)?.icon_url ?? null)] as const));
  const icons = new Map<string, string | null>(iconPairs);

  // Without the Thai font, non-Latin characters would render as empty boxes: fall back to a generic title.
  const shownTitle = font ? title : title.replace(/[^\x20-\x7e]/g, "").trim() || "Community Draft";

  const root = el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: OG_WIDTH,
      height: OG_HEIGHT,
      padding: "40px 56px",
      color: "#F2F3F5",
      fontFamily: font ? "Kanit" : "sans-serif",
      background: "linear-gradient(135deg, #0A0B0E 0%, #14161B 55%, #1C1F26 100%)",
      borderTop: `8px solid ${GOLD}`,
    },
    [
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
        el("div", { display: "flex", alignItems: "baseline", gap: 14 }, [
          el("div", { display: "flex", fontSize: 38, color: GOLD }, "RoV LAB"),
          el("div", { display: "flex", fontSize: 20, color: MUTED, letterSpacing: 3 }, "DRAFT ASSISTANT"),
        ]),
        el("div", { display: "flex", gap: 12 }, [
          badge(fmt, true),
          row.global_ban_pick && row.format !== "single" ? badge("GLOBAL BAN/PICK", false) : null,
        ]),
      ]),
      el("div", { display: "flex", fontSize: title.length > 24 ? 50 : 64, lineHeight: 1.25, maxHeight: 130, overflow: "hidden" }, shownTitle),
      el("div", { display: "flex", alignItems: "flex-end", justifyContent: "space-between" }, [
        team(gameCount > 1 ? "YOUR TEAM · GAME 1" : "YOUR TEAM", GOLD, mine, heroes, icons),
        el("div", { display: "flex", fontSize: 34, color: MUTED, paddingBottom: 28 }, "VS"),
        team("ENEMY", BLUE, enemy, heroes, icons),
      ]),
      el("div", { display: "flex", justifyContent: "space-between", fontSize: 22, color: MUTED }, [
        el("div", { display: "flex" }, "rovlab.vercel.app"),
        el("div", { display: "flex" }, gameCount > 1 ? `${gameCount} GAMES` : "1 GAME"),
      ]),
    ]
  );

  return new ImageResponse(root as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: font ? [{ name: "Kanit", data: font, weight: 700, style: "normal" }] : undefined,
    headers: { "Cache-Control": CACHE },
  });
}
