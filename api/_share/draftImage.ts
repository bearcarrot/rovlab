// 1200x630 social card for a Community Draft. Rendered with @vercel/og (satori) on the edge.
// Shows: brand, title, format / Global Ban-Pick badges, and Game 1 picks for both teams (hero icons).
// Shared helpers (font, icon loading, tiles) live in ./imageKit.

import { ImageResponse } from "@vercel/og";
import { parseSeries, TEAM_SIZE } from "../../src/features/draft/series";
import { shortIdToUuid } from "../../src/features/share/shareId";
import { OG_HEIGHT, OG_WIDTH } from "./html";
import { BLUE, CACHE, el, GOLD, heroTile, iconDataUri, loadFont, MUTED, SLUG, badge, type El, type HeroRow } from "./imageKit";
import { restSelect } from "./supabase";

const ICON = 88;

interface DraftRow {
  title: string;
  format: string;
  global_ban_pick: boolean;
  series: unknown;
}

function team(label: string, color: string, slugs: (string | null)[], heroes: Map<string, HeroRow>, icons: Map<string, string | null>): El {
  return el("div", { display: "flex", flexDirection: "column", gap: 12 }, [
    el("div", { display: "flex", fontSize: 20, color, letterSpacing: 2 }, label),
    el(
      "div",
      { display: "flex", gap: 10 },
      slugs.map((s) =>
        heroTile({
          size: ICON,
          filled: !!s,
          name: s ? heroes.get(s)?.name ?? s : null,
          icon: s ? icons.get(s) ?? null : null,
          color,
          border: 3,
          radius: 14,
          fontSize: 28,
        })
      )
    ),
  ]);
}

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

  const [heroRows, font] = await Promise.all([
    slugs.length ? restSelect<HeroRow>("heroes", `select=id,slug,name,icon_url&slug=in.(${slugs.join(",")})`) : Promise.resolve([] as HeroRow[]),
    loadFont(`${title}${labels}`),
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
