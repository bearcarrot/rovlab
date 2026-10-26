// 1200x630 social card for a Community Tier List. Same look as the in-app share PNG (src/lib/share-image/templates/tier-list.ts):
// gold glow on #0A0B0E, logo + brand header, title, "Patch · filter" meta line, one rounded card per tier row (user-defined labels/colors; legacy lists = S+ S A B C) with a
// coloured label block and rounded hero icons, divider + footer. Landscape, so rows are capped ("+N" for the rest).
// A list that stores independent per-lane Tiers ("lanes") is drawn as Tier rows x lane columns (same data as the lane grid in the app).
// Hero ids in the data are heroes.id (uuid, same as HeroSummary.id in the board); plain slugs are accepted too.
// Colours mirror src/lib/share-image/theme.ts (= tailwind.config.ts).

import { ImageResponse } from "@vercel/og";
import { shortIdToUuid } from "../../src/features/share/shareId";
import { distinctHeroCount, laneHeroIds, parseTierData, readLanes, type LaneAssign, type TierRow } from "../../src/features/tierlist/tierData";
import { readableTextColor } from "../../src/lib/readableText";
import { OG_HEIGHT, OG_WIDTH } from "./html";
import {
  BORDER, brandHeader, cardTitle, CACHE, DISCLAIMER_TH, el, FAINT, footer, heroTile, ICON_STROKE, iconDataUri, loadFont, loadLogo, MUTED, rootStyle,
  SLUG, SURFACE, UUID_RE, type El, type HeroRow,
} from "./imageKit";
import { restSelect } from "./supabase";

const ICON = 50;
const ROW_H = 66;
const ROW_GAP = 8;
const AREA_H = 5 * ROW_H + 4 * ROW_GAP; // space the five legacy rows used; more rows share it
const ROWS_SHOWN = 8; // above this, only rows that hold heroes are shown (the rest is counted in the meta line)
const LABEL_W = 84;
const CAP = 12; // icons per tier row (limits icon downloads; the rest shows as "+N")

// lane grid card
const LANE_ORDER = ["slayer", "jungle", "mid", "abyssal", "roaming"];
const LANE_COLS_MAX = 6;
const LANE_ICON = 30;
const LANE_HEAD_H = 24;
const LANE_GAP = 4;
const LANE_AREA_W = OG_WIDTH - 112 - LABEL_W - 12; // card width minus padding, label block and cell padding

const FILTER_TH = "จัดเอง";
const LANES_TH = "ตามเลน";
const EMPTY_TH = "ยังไม่มีฮีโร่";
const HEROES_TH = "ฮีโร่";
const ROWS_TH = "แถว";

interface TierListRow {
  title: string;
  patch: string | null;
  data: unknown;
}

interface Shown {
  row: TierRow;
  ids: string[];
  extra: number;
}

interface LaneShown {
  row: TierRow;
  cells: { ids: string[] }[];
}

function tierCard(s: Shown, rowH: number, heroes: Map<string, HeroRow>, icons: Map<string, string | null>, showThai: boolean): El {
  const { row, ids, extra } = s;
  const icon = Math.min(ICON, rowH - 16);
  const label = showThai ? row.label : row.label.replace(/[^\x20-\x7e]/g, "").trim() || "-"; // no Thai font: avoid empty boxes
  const len = Math.max(1, label.length);
  const base = rowH < ROW_H ? Math.floor(rowH * 0.55) : len > 1 ? 34 : 40;
  const labelSize = Math.max(12, Math.min(base, Math.floor(72 / (len * 0.62))));
  return el("div", { display: "flex", alignItems: "stretch", height: rowH, borderRadius: 16, overflow: "hidden", background: SURFACE, border: `1px solid ${BORDER}` }, [
    el(
      "div",
      { display: "flex", alignItems: "center", justifyContent: "center", width: LABEL_W, overflow: "hidden", background: row.color, color: readableTextColor(row.color), fontSize: labelSize },
      label
    ),
    el("div", { display: "flex", alignItems: "center", flex: 1, gap: 6, paddingLeft: 12 }, [
      ids.length === 0 && showThai ? el("div", { display: "flex", fontSize: 20, color: FAINT }, EMPTY_TH) : null,
      ...ids.map((id) =>
        heroTile({ size: icon, filled: true, name: heroes.get(id)?.name ?? null, icon: icons.get(id) ?? null, color: ICON_STROKE, border: 1, radius: 9, fontSize: 17, initialsColor: FAINT })
      ),
      extra > 0 ? el("div", { display: "flex", fontSize: 22, color: MUTED, paddingLeft: 6 }, `+${extra}`) : null,
    ]),
  ]);
}

// Tier row of the lane grid: label block + one cell per lane column (heroes of that lane in this Tier).
function laneCard(s: LaneShown, rowH: number, cap: number, heroes: Map<string, HeroRow>, icons: Map<string, string | null>, showThai: boolean): El {
  const { row, cells } = s;
  const icon = Math.min(LANE_ICON, rowH - 12);
  const label = showThai ? row.label : row.label.replace(/[^\x20-\x7e]/g, "").trim() || "-";
  const len = Math.max(1, label.length);
  const labelSize = Math.max(12, Math.min(Math.floor(rowH * 0.55), len > 1 ? 30 : 36, Math.floor(72 / (len * 0.62))));
  return el("div", { display: "flex", alignItems: "stretch", height: rowH, borderRadius: 14, overflow: "hidden", background: SURFACE, border: `1px solid ${BORDER}` }, [
    el(
      "div",
      { display: "flex", alignItems: "center", justifyContent: "center", width: LABEL_W, overflow: "hidden", background: row.color, color: readableTextColor(row.color), fontSize: labelSize },
      label
    ),
    el(
      "div",
      { display: "flex", flex: 1, gap: LANE_GAP, padding: "0 6px" },
      cells.map((c) => {
        const ids = c.ids.length > cap ? c.ids.slice(0, Math.max(1, cap - 1)) : c.ids;
        const extra = c.ids.length - ids.length;
        return el("div", { display: "flex", flex: 1, minWidth: 0, alignItems: "center", gap: 3, overflow: "hidden" }, [
          ...ids.map((id) =>
            heroTile({ size: icon, filled: true, name: heroes.get(id)?.name ?? null, icon: icons.get(id) ?? null, color: ICON_STROKE, border: 1, radius: 7, fontSize: 12, initialsColor: FAINT })
          ),
          extra > 0 ? el("div", { display: "flex", fontSize: 16, color: MUTED }, `+${extra}`) : null,
        ]);
      })
    ),
  ]);
}

const laneHead = (codes: string[]): El =>
  el(
    "div",
    { display: "flex", height: LANE_HEAD_H, alignItems: "center", paddingLeft: LABEL_W + 7, paddingRight: 7, gap: LANE_GAP },
    codes.map((c) => el("div", { display: "flex", flex: 1, minWidth: 0, overflow: "hidden", fontSize: 16, color: MUTED, letterSpacing: 1 }, c.toUpperCase()))
  );

/** Lane columns to draw: the standard lanes first (in order), then any other lane the owner used. */
const laneColumns = (lanes: LaneAssign): string[] =>
  [...LANE_ORDER.filter((c) => c in lanes), ...Object.keys(lanes).filter((c) => !LANE_ORDER.includes(c)).sort()].slice(0, LANE_COLS_MAX);

/** Returns null when the Tier List is invalid / unpublished; throws when the backend is unreachable. */
export async function renderTierListImage(rawId: string): Promise<Response | null> {
  const uuid = shortIdToUuid(rawId);
  if (!uuid) return null;
  const rows = await restSelect<TierListRow>("community_tier_lists", `select=title,patch,data&id=eq.${uuid}&limit=1`);
  if (rows === null) throw new Error("tier list lookup failed");
  const row = rows[0];
  if (!row) return null;

  // parseTierData reads the list's own "dup" flag, so a hero placed in several rows is drawn in every row
  const data = parseTierData(row.data);
  const lanes = readLanes(row.data, data); // independent per-lane Tiers; null = traditional list
  const codes = lanes ? laneColumns(lanes) : [];
  // different heroes (a hero in two rows/lanes counts once), same as tier_hero_count in the DB
  const total = lanes ? new Set([...data.flatMap((r) => r.heroes), ...laneHeroIds(lanes)]).size : distinctHeroCount(data);

  // traditional rows
  const crowded = data.length > ROWS_SHOWN;
  const visible = crowded ? data.filter((r) => r.heroes.length > 0).slice(0, ROWS_SHOWN) : data;
  const capped: Shown[] = lanes ? [] : visible.map((row) => ({ row, ids: row.heroes.slice(0, CAP), extra: Math.max(0, row.heroes.length - CAP) }));
  const rowH = Math.min(ROW_H, Math.floor((AREA_H - ROW_GAP * Math.max(0, capped.length - 1)) / Math.max(1, capped.length)));

  // lane grid: only Tier rows that hold heroes in some lane (empty rows are not drawn)
  const laneRows = lanes ? data.filter((r) => codes.some((c) => (lanes[c]?.[r.id] ?? []).length > 0)).slice(0, ROWS_SHOWN) : [];
  const laneRowH = Math.max(
    30,
    Math.min(ROW_H, Math.floor((AREA_H - LANE_HEAD_H - ROW_GAP - ROW_GAP * Math.max(0, laneRows.length - 1)) / Math.max(1, laneRows.length)))
  );
  const laneIcon = Math.min(LANE_ICON, laneRowH - 12);
  const cellW = Math.floor((LANE_AREA_W - LANE_GAP * Math.max(0, codes.length - 1)) / Math.max(1, codes.length));
  const laneCap = Math.max(2, Math.floor(cellW / (laneIcon + 3)));
  const lanePlan: LaneShown[] = lanes
    ? laneRows.map((r) => ({ row: r, cells: codes.map((c) => ({ ids: (lanes[c]?.[r.id] ?? []).slice(0, laneCap + 1) })) }))
    : [];
  const hiddenRows = lanes ? 0 : data.length - visible.length;

  const wanted = [...new Set(lanes ? lanePlan.flatMap((s) => s.cells.flatMap((c) => c.ids)) : capped.flatMap((s) => s.ids))];
  const uuids = wanted.filter((id) => UUID_RE.test(id));
  const slugs = wanted.filter((id) => !UUID_RE.test(id) && SLUG.test(id));
  const filters = [uuids.length ? `id.in.(${uuids.join(",")})` : "", slugs.length ? `slug.in.(${slugs.join(",")})` : ""].filter(Boolean);

  const title = Array.from(row.title.trim()).slice(0, 50).join("");
  const patch = (row.patch ?? "").trim();
  const rowLabels = (lanes ? laneRows : visible).map((r) => r.label).join("");
  const labels = `RoV LAB TIER LIST Patch S+ S A B C 0123456789 · .+${patch}${rowLabels}${codes.join("")}${FILTER_TH}${LANES_TH}${EMPTY_TH}${HEROES_TH}${ROWS_TH}${DISCLAIMER_TH}`;

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
  const keep = (id: string) => heroRows === null || heroes.has(id);
  const shown = capped.map((s) => ({ ...s, ids: s.ids.filter(keep) }));
  const laneShown = lanePlan.map((s) => ({ ...s, cells: s.cells.map((c) => ({ ids: c.ids.filter(keep) })) }));
  const iconIds = lanes ? laneShown.flatMap((s) => s.cells.flatMap((c) => c.ids)) : shown.flatMap((s) => s.ids);
  const iconPairs = await Promise.all(
    [...new Set(iconIds)].map(async (id) => [id, await iconDataUri(heroes.get(id)?.icon_url ?? null)] as const)
  );
  const icons = new Map<string, string | null>(iconPairs);

  const showThai = !!font; // without the Thai font those glyphs would render as empty boxes
  const shownTitle = font ? title : title.replace(/[^\x20-\x7e]/g, "").trim() || "Community Tier List";
  const shownPatch = font ? patch : patch.replace(/[^\x20-\x7e]/g, "").trim();
  const filterLabel = lanes ? `${FILTER_TH} · ${LANES_TH}` : FILTER_TH;
  const meta = [shownPatch ? `Patch ${shownPatch}` : "", showThai ? filterLabel : "", showThai ? `${total} ${HEROES_TH}` : `${total} HEROES`, hiddenRows > 0 && showThai ? `+${hiddenRows} ${ROWS_TH}` : ""]
    .filter(Boolean)
    .join("  ·  ");

  const body = lanes
    ? el("div", { display: "flex", flexDirection: "column", gap: ROW_GAP }, [
        laneHead(codes),
        ...laneShown.map((s) => laneCard(s, laneRowH, laneCap, heroes, icons, showThai)),
      ])
    : el(
        "div",
        { display: "flex", flexDirection: "column", gap: ROW_GAP },
        shown.map((s) => tierCard(s, rowH, heroes, icons, showThai))
      );

  const root = el("div", rootStyle(!!font, "24px 56px 22px"), [
    brandHeader(logo, "TIER LIST"),
    el("div", { display: "flex", flexDirection: "column" }, [cardTitle(shownTitle), el("div", { display: "flex", fontSize: 24, color: MUTED }, meta)]),
    body,
    footer(showThai, true),
  ]);

  return new ImageResponse(root as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: font ? [{ name: "Kanit", data: font, weight: 700, style: "normal" }] : undefined,
    headers: { "Cache-Control": CACHE },
  });
}
