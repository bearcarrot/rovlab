// One resolver per shareable kind. A resolver turns the id from the URL into public-safe page metadata.
// Adding another kind = add it to ShareKind + SHARE_PATH, write its resolver here, and an image renderer in api/_share.
// The HTML handler (api/share-meta.ts) and the image handler (api/share-image.ts) dispatch on `kind`.

import { shortIdToUuid, uuidToShortId } from "../../src/features/share/shareId";
import { parseTierData, tierHeroCount } from "../../src/features/tierlist/tierData";
import { SITE } from "./html";
import { restSelect } from "./supabase";

export type ShareKind = "draft" | "tier-list";
export const SHARE_PATH: Record<ShareKind, string> = { draft: "/draft", "tier-list": "/tier-list" };
export const isShareKind = (v: string): v is ShareKind => v === "draft" || v === "tier-list";

export interface ResolvedShare {
  title: string;
  description: string;
  url: string;
  image: { url: string; alt: string };
}
/** ok = published; missing = invalid id / deleted / unpublished / hidden; error = backend unreachable (don't cache for long). */
export type ShareLookup = { status: "ok"; meta: ResolvedShare } | { status: "missing" } | { status: "error" };

const clip = (s: string, max: number): string => {
  const chars = Array.from(s);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : s;
};

const FORMAT_LABEL: Record<string, string> = { single: "เดี่ยว", bo3: "BO3", bo5: "BO5", bo7: "BO7" };

interface DraftRow {
  id: string;
  title: string;
  description: string | null;
  format: string;
  global_ban_pick: boolean;
  version: number | null;
}

async function resolveDraft(rawId: string): Promise<ShareLookup> {
  const uuid = shortIdToUuid(rawId); // accepts the 22-char short id and legacy full UUIDs
  if (!uuid) return { status: "missing" };
  // Public columns only (no owner / author). RLS ("read visible community drafts") hides hidden rows from anon.
  const rows = await restSelect<DraftRow>(
    "community_drafts",
    `select=id,title,description,format,global_ban_pick,version&id=eq.${uuid}&limit=1`
  );
  if (rows === null) return { status: "error" };
  const row = rows[0];
  if (!row || !row.title) return { status: "missing" };

  const shortId = uuidToShortId(uuid); // canonical is always the short form, so UUID and short links dedupe
  const label = FORMAT_LABEL[row.format] ?? "";
  const head = `Draft RoV ${label}${row.global_ban_pick && row.format !== "single" ? " · Global Ban/Pick" : ""}`.replace(/\s+/g, " ").trim();
  const note = clip((row.description ?? "").replace(/\s+/g, " ").trim(), 120);
  const title = clip(row.title.trim(), 80);
  return {
    status: "ok",
    meta: {
      title: `${title} — RoV Draft | RoV LAB`,
      description: note ? `${head} — ${note}` : `${head} — ดู Pick/Ban ของแต่ละเกม แล้วลองวิเคราะห์ต่อได้ที่ RoV LAB`,
      url: `${SITE}${SHARE_PATH.draft}/${shortId}`,
      // v = snapshot version: a republished Draft gets a new image URL, so platforms never keep a stale preview
      image: { url: `${SITE}/api/share-image?kind=draft&id=${shortId}&v=${row.version ?? 1}`, alt: `Draft RoV: ${title}` },
    },
  };
}

interface TierListRow {
  id: string;
  title: string;
  description: string | null;
  patch: string | null;
  version: number | null;
  data: unknown;
}

async function resolveTierList(rawId: string): Promise<ShareLookup> {
  const uuid = shortIdToUuid(rawId);
  if (!uuid) return { status: "missing" };
  // Public columns only (no owner / author). RLS ("read visible community tier lists") hides hidden rows from anon.
  const rows = await restSelect<TierListRow>(
    "community_tier_lists",
    `select=id,title,description,patch,version,data&id=eq.${uuid}&limit=1`
  );
  if (rows === null) return { status: "error" };
  const row = rows[0];
  if (!row || !row.title) return { status: "missing" };

  const shortId = uuidToShortId(uuid);
  const count = tierHeroCount(parseTierData(row.data));
  const patch = (row.patch ?? "").trim();
  const head = `Tier List RoV · ${count} ฮีโร่${patch ? ` · Patch ${patch}` : ""}`;
  const note = clip((row.description ?? "").replace(/\s+/g, " ").trim(), 120);
  const title = clip(row.title.trim(), 80);
  return {
    status: "ok",
    meta: {
      title: `${title} — RoV Tier List | RoV LAB`,
      description: note ? `${head} — ${note}` : `${head} — ดูการจัดอันดับฮีโร่และร่วมโหวตได้ที่ RoV LAB`,
      url: `${SITE}${SHARE_PATH["tier-list"]}/${shortId}`,
      image: { url: `${SITE}/api/share-image?kind=tier-list&id=${shortId}&v=${row.version ?? 1}`, alt: `Tier List RoV: ${title}` },
    },
  };
}

export function resolveShare(kind: ShareKind, rawId: string): Promise<ShareLookup> {
  switch (kind) {
    case "draft":
      return resolveDraft(rawId);
    case "tier-list":
      return resolveTierList(rawId);
  }
}
