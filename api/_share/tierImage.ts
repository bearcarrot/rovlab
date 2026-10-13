// 1200x630 social card for a Community Tier List: brand, title, patch / hero-count badges and one row per non-empty tier
// (S+ S A B C) with hero icons. Rows are capped so the card stays readable on mobile; the rest shows as "+N".
// Hero ids in the data are heroes.id (uuid, same as HeroSummary.id in the board); plain slugs are accepted too.
// Colours mirror the site theme (tailwind.config.ts: colors.tier, bg, border, text) and the Badge component (white label).

import { ImageResponse } from "@vercel/og";
import { shortIdToUuid } from "../../src/features/share/shareId";
import { parseTierData, tierHeroCount, TIER_KEYS, type TierKey } from "../../src/features/tierlist/tierData";
import { OG_HEIGHT, OG_WIDTH } from "./html";
import { badge, CACHE, el, GOLD, heroTile, iconDataUri, loadFont, MUTED, SLUG, UUID_RE, type El, type HeroRow } from "./imageKit";
import { restSelect } from "./supabase";

const ICON = 56;
const CAP: Record<TierKey, number> = { "S+": 12, S: 12, A: 10, B: 8, C: 6 };
// tailwind.config.ts -> colors.tier (sp, s, a, b, c)
const TIER_COLOR: Record<TierKey, string> = { "S+": "#EF4444", S: "#F97316", A: "#EAB308", B: "#22C55E", C: "#3B82F6" };

interface TierRow {
  title: string;
  patch: string | null;
  data: unknown;
}

function tierRow(key: TierKey, ids: string[], extra: number, heroes: Map<string, HeroRow>, icons: Map<string, string | null>): El {
  const color = TIER_COLOR[key];
  return el("div", { display: "flex", alignItems: "center", gap: 10 }, [
    el("div", { display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: ICON, borderRadius: 10, background: color, color: "#FFFFFF", fontSize: 30 }, key),
    ...ids.map((id) =>
      heroTile({ size: ICON, filled: true, name: heroes.get(id)?.name ?? null, icon: icons.get(id) ?? null, color, border: 2, radius: 10, fontSize: 18 })
    ),
    extra > 0 ? el("div", { display: "flex", fontSize: 24, color: MUTED, paddingLeft: 4 }, `+${extra}`) : null,
  ]);
}

/** Returns null when the Tier List is invalid / unpublished; throws when the backend is unreachable. */
export async function renderTierListImage(rawId: string): Promise<Response | null> {
  const uuid = shortIdToUuid(rawId);
  if (!uuid) return null;
  const rows = await restSelect<TierRow>("community_tier_lists", `select=title,patch,data&id=eq.${uuid}&limit=1`);
  if (rows === null) throw new Error("tier list lookup failed");
  const row = rows[0];
  if (!row) return null;

  const data = parseTierData(row.data);
  const total = tierHeroCount(data);
  const capped = TIER_KEYS.filter((k) => data[k].length > 0).map((k) => ({
    key: k,
    ids: data[k].slice(0, CAP[k]),
    extra: Math.max(0, data[k].length - CAP[k]),
  }));
  const wanted = [...new Set(capped.flatMap((s) => s.ids))];
  const uuids = wanted.filter((id) => UUID_RE.test(id));
  const slugs = wanted.filter((id) => !UUID_RE.test(id) && SLUG.test(id));
  const filters = [uuids.length ? `id.in.(${uuids.join(",")})` : "", slugs.length ? `slug.in.(${slugs.join(",")})` : ""].filter(Boolean);

  const title = Array.from(row.title.trim()).slice(0, 50).join("");
  const patch = (row.patch ?? "").trim();
  const labels = `RoV LAB TIER LIST HEROES HERO PATCH S+ S A B C 0123456789 · ${patch}`;

  const [heroRows, font] = await Promise.all([
    filters.length ? restSelect<HeroRow>("heroes", `select=id,slug,name,icon_url&or=(${filters.join(",")})`) : Promise.resolve([] as HeroRow[]),
    loadFont(`${title}${labels}`),
  ]);
  const heroes = new Map<string, HeroRow>();
  for (const h of heroRows ?? []) {
    heroes.set(h.id, h);
    heroes.set(h.slug, h);
  }
  // Like the board, skip heroes that no longer exist. If the heroes lookup itself failed, keep every id (blank tiles) instead.
  const shown = capped
    .map((s) => ({ ...s, ids: heroRows === null ? s.ids : s.ids.filter((id) => heroes.has(id)) }))
    .filter((s) => s.ids.length > 0);
  const iconPairs = await Promise.all(
    [...new Set(shown.flatMap((s) => s.ids))].map(async (id) => [id, await iconDataUri(heroes.get(id)?.icon_url ?? null)] as const)
  );
  const icons = new Map<string, string | null>(iconPairs);

  const shownTitle = font ? title : title.replace(/[^\x20-\x7e]/g, "").trim() || "Community Tier List";
  const shownPatch = font ? patch : patch.replace(/[^\x20-\x7e]/g, "").trim();

  const root = el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: OG_WIDTH,
      height: OG_HEIGHT,
      padding: "32px 56px",
      color: "#F2F3F5",
      fontFamily: font ? "Kanit" : "sans-serif",
      background: "linear-gradient(135deg, #0A0B0E 0%, #14161B 55%, #1C1F26 100%)",
      borderTop: `8px solid ${GOLD}`,
    },
    [
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
        el("div", { display: "flex", alignItems: "baseline", gap: 14 }, [
          el("div", { display: "flex", fontSize: 38, color: GOLD }, "RoV LAB"),
          el("div", { display: "flex", fontSize: 20, color: MUTED, letterSpacing: 3 }, "TIER LIST"),
        ]),
        el("div", { display: "flex", gap: 12 }, [
          shownPatch ? badge(`PATCH ${shownPatch}`, true) : null,
          badge(`${total} HEROES`, false),
        ]),
      ]),
      el("div", { display: "flex", fontSize: title.length > 28 ? 44 : 54, lineHeight: 1.25, maxHeight: 70, overflow: "hidden" }, shownTitle),
      el(
        "div",
        { display: "flex", flexDirection: "column", gap: 8 },
        shown.map((s) => tierRow(s.key, s.ids, s.extra, heroes, icons))
      ),
      el("div", { display: "flex", justifyContent: "space-between", fontSize: 22, color: MUTED }, [
        el("div", { display: "flex" }, "rovlab.vercel.app"),
        el("div", { display: "flex" }, "COMMUNITY TIER LIST"),
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
