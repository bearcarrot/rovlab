// 1200x630 social card for a Community Draft. Same look as the in-app share PNG (src/lib/share-image/templates/draft-assistant.ts):
// glow background, logo header, "ทีมเรา" (green) / "ทีมศัตรู" (red) cards with icon + hero name per slot, dashed empty slots, footer.
// Shows Game 1 of the series. The PNG's live analysis (overview meters, recommended picks) is computed in the browser and is not
// stored with a published Draft, so it is not part of this card.

import { ImageResponse } from "@vercel/og";
import { parseSeries, TEAM_SIZE } from "../../src/features/draft/series";
import { shortIdToUuid } from "../../src/features/share/shareId";
import { OG_HEIGHT, OG_WIDTH } from "./html";
import {
  BORDER, brandHeader, cardTitle, CACHE, DISCLAIMER_TH, el, FAINT, footer, heroTile, ICON_STROKE, iconDataUri, loadFont, loadLogo, LOSS, MUTED, rootStyle,
  SLUG, SURFACE, WIN, type El, type HeroRow,
} from "./imageKit";
import { restSelect } from "./supabase";

const ICON = 58;
const ROW_H = 68;
const TEAM_TH = "ทีมเรา";
const ENEMY_TH = "ทีมศัตรู";

interface DraftRow {
  title: string;
  format: string;
  global_ban_pick: boolean;
  series: unknown;
}

function slotRow(slug: string | null, heroes: Map<string, HeroRow>, icons: Map<string, string | null>): El {
  const name = slug ? heroes.get(slug)?.name ?? slug : null;
  const tile = slug
    ? heroTile({ size: ICON, filled: true, name, icon: icons.get(slug) ?? null, color: ICON_STROKE, border: 1, radius: 10, fontSize: 20, initialsColor: FAINT })
    : el("div", { display: "flex", width: ICON, height: ICON, borderRadius: 10, border: `2px dashed ${BORDER}` }, " ");
  return el("div", { display: "flex", alignItems: "center", gap: 16, height: ROW_H }, [
    tile,
    el("div", { display: "flex", fontSize: slug ? 26 : 22, color: slug ? "#F2F3F5" : FAINT, maxWidth: 380, overflow: "hidden" }, name ?? "Empty Slot"),
  ]);
}

function teamCard(label: string, color: string, slots: (string | null)[], heroes: Map<string, HeroRow>, icons: Map<string, string | null>): El {
  return el("div", { display: "flex", flexDirection: "column", flex: 1, padding: "10px 20px", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }, [
    el("div", { display: "flex", alignItems: "center", height: 36, fontSize: 24, color }, label),
    ...slots.map((s) => slotRow(s, heroes, icons)),
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
  const fill = (picks: (string | null)[] | undefined): (string | null)[] => Array.from({ length: TEAM_SIZE }, (_, i) => picks?.[i] ?? null);
  const mine = fill(game?.mine.picks);
  const enemy = fill(game?.enemy.picks);
  const slugs = [...new Set([...mine, ...enemy].filter((s): s is string => !!s && SLUG.test(s)))];

  const gameCount = series?.games.length ?? 1;
  const title = Array.from(row.title.trim()).slice(0, 56).join("");
  const mode = [
    row.format === "single" ? "SINGLE" : row.format.toUpperCase(),
    row.global_ban_pick && row.format !== "single" ? "GLOBAL BAN/PICK" : "",
    gameCount > 1 ? `GAME 1 / ${gameCount}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  const labels = `${TEAM_TH}${ENEMY_TH}${DISCLAIMER_TH} DRAFT ASSISTANT Empty Slot RoV LAB GLOBAL BAN/PICK SINGLE GAME BO3 BO5 BO7 0123456789 · /`;

  const [heroRows, font, logo] = await Promise.all([
    slugs.length ? restSelect<HeroRow>("heroes", `select=id,slug,name,icon_url&slug=in.(${slugs.join(",")})`) : Promise.resolve([] as HeroRow[]),
    loadFont(`${title}${labels}`),
    loadLogo(),
  ]);
  const heroes = new Map((heroRows ?? []).map((h) => [h.slug, h]));
  const iconPairs = await Promise.all(slugs.map(async (s) => [s, await iconDataUri(heroes.get(s)?.icon_url ?? null)] as const));
  const icons = new Map<string, string | null>(iconPairs);

  // Without the Thai font, Thai glyphs would render as empty boxes: fall back to English labels / a generic title.
  const shownTitle = font ? title : title.replace(/[^\x20-\x7e]/g, "").trim() || "Community Draft";

  const root = el("div", rootStyle(!!font, "24px 56px 22px"), [
    brandHeader(logo, "DRAFT ASSISTANT", el("div", { display: "flex", fontSize: 22, color: MUTED }, mode)),
    cardTitle(shownTitle),
    el("div", { display: "flex", gap: 32 }, [
      teamCard(font ? TEAM_TH : "YOUR TEAM", WIN, mine, heroes, icons),
      teamCard(font ? ENEMY_TH : "ENEMY", LOSS, enemy, heroes, icons),
    ]),
    footer(!!font, false),
  ]);

  return new ImageResponse(root as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: font ? [{ name: "Kanit", data: font, weight: 700, style: "normal" }] : undefined,
    headers: { "Cache-Control": CACHE },
  });
}
