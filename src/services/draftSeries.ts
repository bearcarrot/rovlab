import { supabase } from "@/lib/supabase";
import { copyName } from "@/features/community/format";
import { toReaction, type Reaction } from "@/features/community/reactions";
import { createSeries, legacyTeams, parseSeries, type DraftSeries, type SeriesFormat } from "@/features/draft/series";
import { trackActivity } from "@/services/activity";

// My Drafts (public.saved_drafts, own rows only via RLS) and Community Drafts
// (public.community_drafts snapshots, read through the list_community_drafts RPC).
// Snapshots and like counts are written only by DB triggers / RPCs, never directly from here.

export type Visibility = "private" | "public";
export const DRAFT_NAME_MAX = 80;
export const DRAFT_DESC_MAX = 500;

export interface MyDraftSummary {
  id: string;
  name: string;
  description: string;
  format: SeriesFormat;
  globalBanPick: boolean;
  visibility: Visibility;
  updatedAt: string;
}
export interface MyDraft extends MyDraftSummary {
  series: DraftSeries;
}

export interface CommunityDraftSummary {
  id: string;
  ownerId: string;
  authorName: string;
  handle: string | null;
  avatarUrl: string | null;
  verifiedCategory: string | null; // Verified Creator badge for the author (null = not verified)
  title: string;
  description: string;
  format: SeriesFormat;
  globalBanPick: boolean;
  version: number;
  likes: number;
  dislikes: number;
  myValue: Reaction;
  publishedAt: string;
  updatedAt: string;
}

export type CommunitySort = "new" | "popular" | "liked";

function check(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || "เกิดข้อผิดพลาด");
}

const FORMATS: SeriesFormat[] = ["single", "bo3", "bo5", "bo7"];
const asFormat = (v: unknown): SeriesFormat => FORMATS.find((f) => f === v) ?? "single";
const SUMMARY_COLS = "id, name, description, format, global_ban_pick, visibility, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSummary = (r: any): MyDraftSummary => ({
  id: r.id,
  name: r.name ?? "",
  description: r.description ?? "",
  format: asFormat(r.format),
  globalBanPick: r.global_ban_pick === true,
  visibility: r.visibility === "public" ? "public" : "private",
  updatedAt: r.updated_at,
});

export async function listMyDrafts(): Promise<MyDraftSummary[]> {
  const { data, error } = await supabase.from("saved_drafts").select(SUMMARY_COLS).order("updated_at", { ascending: false });
  check(error);
  return (data ?? []).map(toSummary);
}

export async function getMyDraft(id: string): Promise<MyDraft> {
  const { data, error } = await supabase.from("saved_drafts").select(`${SUMMARY_COLS}, series`).eq("id", id).single();
  check(error);
  void trackActivity("draft_loaded", { draft_id: id }, { once: true });
  return { ...toSummary(data), series: parseSeries(data?.series) ?? createSeries("single") };
}

export interface SaveDraftInput {
  userId: string;
  id?: string | null; // update when given, insert otherwise
  name: string;
  description: string;
  visibility: Visibility;
  series: DraftSeries;
}

/** Insert or update. Making a draft public creates the community snapshot (DB trigger); editing an already public draft does not. */
export async function saveDraft(input: SaveDraftInput): Promise<string> {
  const { myTeam, enemyTeam } = legacyTeams(input.series);
  const row = {
    name: input.name.trim() || null,
    description: input.description.trim() || null,
    format: input.series.format,
    global_ban_pick: input.series.globalBanPick,
    game7_rule: input.series.game7Rule,
    series: input.series,
    my_team: myTeam, // kept for backward compatibility with the original saved_drafts shape
    enemy_team: enemyTeam,
    visibility: input.visibility,
  };
  if (input.id) {
    const { data, error } = await supabase.from("saved_drafts").update(row).eq("id", input.id).select("id").single();
    check(error);
    return data!.id as string;
  }
  const { data, error } = await supabase.from("saved_drafts").insert({ ...row, user_id: input.userId }).select("id").single();
  check(error);
  const newId = data!.id as string;
  void trackActivity("draft_created", { draft_id: newId });
  return newId;
}

/** New private draft owned by the user with the same series (used by Duplicate and Load Preset). */
export async function createDraftCopy(userId: string, src: { name: string; description: string; series: DraftSeries }): Promise<string> {
  return saveDraft({
    userId,
    name: copyName(src.name, DRAFT_NAME_MAX),
    description: src.description,
    visibility: "private",
    series: src.series,
  });
}

export async function duplicateDraft(userId: string, id: string): Promise<string> {
  const d = await getMyDraft(id);
  return createDraftCopy(userId, d);
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabase.from("saved_drafts").delete().eq("id", id);
  check(error);
}

export async function setDraftVisibility(id: string, visibility: Visibility): Promise<void> {
  const { error } = await supabase.from("saved_drafts").update({ visibility }).eq("id", id);
  check(error);
}

/** Publish (private -> public) or push a new snapshot version of an already public draft. */
export async function publishDraft(id: string): Promise<void> {
  const { error } = await supabase.rpc("publish_draft", { p_id: id });
  check(error);
  void trackActivity("draft_shared", { draft_id: id });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCommunity = (r: any): CommunityDraftSummary => ({
  id: r.id,
  ownerId: r.owner_id,
  authorName: r.author_name ?? "",
  handle: r.handle ?? null,
  avatarUrl: r.avatar_url ?? null,
  verifiedCategory: r.verified_category ?? null,
  title: r.title,
  description: r.description ?? "",
  format: asFormat(r.format),
  globalBanPick: r.global_ban_pick === true,
  version: r.version ?? 1,
  likes: r.like_count ?? 0,
  dislikes: r.dislike_count ?? 0,
  myValue: toReaction(r.my_value),
  publishedAt: r.published_at,
  updatedAt: r.updated_at,
});

export async function listCommunityDrafts(args: {
  sort: CommunitySort;
  q: string;
  offset: number;
  limit: number;
}): Promise<CommunityDraftSummary[]> {
  const { data, error } = await supabase.rpc("list_community_drafts", {
    p_sort: args.sort,
    p_q: args.q.trim() || null,
    p_limit: args.limit,
    p_offset: args.offset,
  });
  check(error);
  return (data ?? []).map(toCommunity);
}

export async function getCommunityDraft(id: string): Promise<CommunityDraftSummary & { series: DraftSeries }> {
  const { data, error } = await supabase.rpc("list_community_drafts", { p_only_id: id, p_limit: 1 });
  check(error);
  const row = data?.[0];
  if (!row) throw new Error("ไม่พบ Draft นี้ (อาจถูกเอาออกจาก Community แล้ว)");
  return { ...toCommunity(row), series: parseSeries(row.series) ?? createSeries("single") };
}

/** value 0 removes the reaction. One row per (draft, user): switching like <-> dislike is an upsert. */
export async function reactToDraft(draftId: string, userId: string, value: Reaction): Promise<void> {
  if (value === 0) {
    const { error } = await supabase.from("community_draft_reactions").delete().eq("draft_id", draftId).eq("user_id", userId);
    check(error);
    return;
  }
  const { error } = await supabase
    .from("community_draft_reactions")
    .upsert({ draft_id: draftId, user_id: userId, value }, { onConflict: "draft_id,user_id" });
  check(error);
}
