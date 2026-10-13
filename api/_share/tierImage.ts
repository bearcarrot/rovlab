// 1200x630 social card for a Community Tier List. Same look as the in-app share PNG (src/lib/share-image/templates/tier-list.ts):
// gold glow on #0A0B0E, logo + brand header, title, "Patch · filter" meta line, one rounded card per tier (S+ S A B C) with a
// coloured label block and rounded hero icons, divider + footer. Landscape, so rows are capped ("+N" for the rest).
// Hero ids in the data are heroes.id (uuid, same as HeroSummary.id in the board); plain slugs are accepted too.
// Colours mirror src/lib/share-image/theme.ts (= tailwind.config.ts).

import { ImageResponse } from "@vercel/og";
import { shortIdToUuid } from "../../src/features/share/shareId";
import { parseTierData, tierHeroCount, TIER_KEYS, type TierKey } from "../../src/features/tierlist/tierData";
import { OG_HEIGHT, OG_WIDTH } from "./html";
import {
  BORDER, brandHeader, cardTitle, CACHE, DISCLAIMER_TH, el, FAINT, footer, heroTile, ICON_STROKE, iconDataUri, loadFont, loadLogo, MUTED, rootStyle,
  SLUG, SURFACE, UUID_RE, type El, type HeroRow,
} from "./imageKit";
import { restSelect } from "./supabase";

const ICON = 50;
const ROW_H = 66;
const LABEL_W = 84;
const CAP = 12; // icons per tier row (limits icon downloads; the rest shows as "+N")
// theme.ts TIER_COLORS (label text is white on every tier, like components/ui/badge.tsx)
const TIER_COLOR: Record<TierKey, string> = { "S+": "#EF4444", S: "#F97316", A: "#EAB308", B: "#22C55E", C: "#3B82F6" };

const FILTER_TH = "จัดเอง";
const EMPTY_TH = "ยังไม่มีฮีโร่";
const HEROES_TH = "ฮีโร่";

interface TierListRow {
  title: string;
  patch: string | null;
  data: unknown;
}

function tierCard(key: TierKey, ids: string[], extra: number, heroes: Map<string, HeroRow>, icons: Map<string, string | null>, showThai: boolean): El {
  const empty = ids.length === 0;
  return el("div", { display: "flex", alignItems: "stretch", height: ROW_H, borderRadius: 16, overflow: "hidden", background: SURFACE, border: `1px solid ${BORDER}` }, [
    el("div", { display: "flex", alignItems: "center", justifyContent: "center", width: LABEL_W, background: TIER_COLOR[key], color: "#FFFFFF", fontSize: key.length > 1 ? 34 : 40 }, key),
    el("div", { display: "flex", alignItems: "center", flex: 1, gap: 6, paddingLeft: 12 }, [
      empty && showThai ? el("div", { display: "flex", fontSize: 20, color: FAINT }, EMPTY_TH) : null,
      ...ids.map((id) =>
        heroTile({ size: ICON, filled: true, name: heroes.get(id)?.name ?? null, icon: icons.get(id) ?? null, color: ICON_STROKE, border: 1, radius: 9, fontSize: 17, initialsColor: FAINT })
      ),
      extra > 0 ? el("div", { display: "flex", fontSize: 22, color: MUTED, paddingLeft: 6 }, `+${extra}`) : null,
    ]),
  ]);
}

/** Returns null when the Tier List is invalid / unpublished; throws when the backend is unreachable. */
export async function renderTierListImage(rawId: string): Promise<Response | null> {
  const uuid = shortIdToUuid(rawId);
  if (!uuid) return null;
  const rows = await restSelect<TierListRow>("community_tier_lists", `select=title,patch,data&id=eq.${uuid}&limit=1`);
  if (rows === null) throw new Error("tier list lookup failed");
  const row = rows[0];
  if (!row) return null;

  const data = parseTierData(row.data);
  const total = tierHeroCount(data);
  const capped = TIER_KEYS.map((k) => ({ key: k, ids: data[k].slice(0, CAP), extra: Math.max(0, data[k].length - CAP) }));
  const wanted = [...new Set(capped.flatMap((s) => s.ids))];
  const uuids = wanted.filter((id) => UUID_RE.test(id));
  const slugs = wanted.filter((id) => !UUID_RE.test(id) && SLUG.test(id));
  const filters = [uuids.length ? `id.in.(${uuids.join(",")})` : "", slugs.length ? `slug.in.(${slugs.join(",")})` : ""].filter(Boolean);

  const title = Array.from(row.title.trim()).slice(0, 50).join("");
  const patch = (row.patch ?? "").trim();
  const labels = `RoV LAB TIER LIST Patch S+ S A B C 0123456789 · .${patch}${FILTER_TH}${EMPTY_TH}${HEROES_TH}${DISCLAIMER_TH}`;

  const [heroRows, font, logo] = await Promise.all([
    filters.length ? restSelect<HeroRow>("heroes", `select=id,slug,name,icon_url&or=(${filters.join(",")})`) : Promise.resolve([] as HeroRow[]),
    loadFont(`${title}${labels}`),
    loadLogo(),
  ]);
  const heroes = new Map<string, HeroRow>();
  for (const h of heroRows ?? []) {
    heroes.set(h.id, h);
    heroes.set(h.slug, h);
  }
  // Like the board, skip heroes that no longer exist. If the heroes lookup itself failed, keep every id (blank tiles) instead.
  const shown = capped.map((s) => ({ ...s, ids: heroRows === null ? s.ids : s.ids.filter((id) => heroes.has(id)) }));
  const iconPairs = await Promise.all(
    [...new Set(shown.flatMap((s) => s.ids))].map(async (id) => [id, await iconDataUri(heroes.get(id)?.icon_url ?? null)] as const)
  );
  const icons = new Map<string, string | null>(iconPairs);

  const showThai = !!font; // without the Thai font those glyphs would render as empty boxes
  const shownTitle = font ? title : title.replace(/[^\x20-\x7e]/g, "").trim() || "Community Tier List";
  const shownPatch = font ? patch : patch.replace(/[^\x20-\x7e]/g, "").trim();
  const meta = [shownPatch ? `Patch ${shownPatch}` : "", showThai ? FILTER_TH : "", showThai ? `${total} ${HEROES_TH}` : `${total} HEROES`].filter(Boolean).join("  ·  ");

  const root = el("div", rootStyle(!!font, "24px 56px 22px"), [
    brandHeader(logo, "TIER LIST"),
    el("div", { display: "flex", flexDirection: "column" }, [cardTitle(shownTitle), el("div", { display: "flex", fontSize: 24, color: MUTED }, meta)]),
    el(
      "div",
      { display: "flex", flexDirection: "column", gap: 8 },
      shown.map((s) => tierCard(s.key, s.ids, s.extra, heroes, icons, showThai))
    ),
    footer(showThai, true),
  ]);

  return new ImageResponse(root as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: font ? [{ name: "Kanit", data: font, weight: 700, style: "normal" }] : undefined,
    headers: { "Cache-Control": CACHE },
  });
}
