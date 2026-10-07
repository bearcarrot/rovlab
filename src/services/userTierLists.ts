import { supabase } from "@/lib/supabase";
import { copyName } from "@/features/community/format";
import { toReaction, type Reaction } from "@/features/community/reactions";
import { parseTierData, type TierData } from "@/features/tierlist/tierData";
import type { Visibility } from "@/services/draftSeries";

// My Tier Lists (public.user_tier_lists, own rows only via RLS) and Community Tier Lists
// (public.community_tier_lists snapshots, read through the list_community_tier_lists RPC).
// NOTE: the admin-managed official lists (tier_lists / tier_list_entries) are untouched.

export const TIER_NAME_MAX = 40; // same limit as the local editor's name field
export const TIER_DESC_MAX = 500;
export const TIER_PATCH_MAX = 20;

export interface MyTierListSummary {
  id: string;
  name: string;
  description: string;
  patch: string;
  visibility: Visibility;
  heroCount: number;
  updatedAt: string;
}
export interface MyTierList extends MyTierListSummary {
  data: TierData;
}

export interface CommunityTierListSummary {
  id: string;
  ownerId: string;
  authorName: string;
  handle: string | null;
  title: string;
  description: string;
  patch: string;
  version: number;
  heroCount: number;
  preview: string[]; // first hero ids in tier order, for card thumbnails
  likes: number;
  dislikes: number;
  myValue: Reaction;
  publishedAt: string;
}

export type CommunitySort = "new" | "popular" | "liked";

function check(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || "เกิดข้อผิดพลาด");
}

const countHeroes = (d: TierData) => Object.values(d).reduce((n, l) => n + l.length, 0);
const COLS = "id, name, description, patch, visibility, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toMine = (r: any): MyTierList => {
  const data = parseTierData(r.data);
  return {
    id: r.id,
    name: r.name ?? "",
    description: r.description ?? "",
    patch: r.patch ?? "",
    visibility: r.visibility === "public" ? "public" : "private",
    heroCount: countHeroes(data),
    updatedAt: r.updated_at,
    data,
  };
};

export async function listMyTierLists(): Promise<MyTierList[]> {
  const { data, error } = await supabase.from("user_tier_lists").select(`${COLS}, data`).order("updated_at", { ascending: false });
  check(error);
  return (data ?? []).map(toMine);
}

export async function getMyTierList(id: string): Promise<MyTierList> {
  const { data, error } = await supabase.from("user_tier_lists").select(`${COLS}, data`).eq("id", id).single();
  check(error);
  return toMine(data);
}

export interface SaveTierListInput {
  userId: string;
  id?: string | null; // update when given, insert otherwise
  name: string;
  description: string;
  patch: string;
  visibility: Visibility;
  data: TierData;
}

/** Making a list public creates the community snapshot (DB trigger); editing an already public list does not. */
export async function saveTierList(input: SaveTierListInput): Promise<string> {
  const row = {
    name: input.name.trim().slice(0, TIER_NAME_MAX) || "Tier List ของฉัน",
    description: input.description.trim() || null,
    patch: input.patch.trim().slice(0, TIER_PATCH_MAX),
    visibility: input.visibility,
    data: parseTierData(input.data),
  };
  if (input.id) {
    const { data, error } = await supabase.from("user_tier_lists").update(row).eq("id", input.id).select("id").single();
    check(error);
    return data!.id as string;
  }
  const { data, error } = await supabase.from("user_tier_lists").insert({ ...row, user_id: input.userId }).select("id").single();
  check(error);
  return data!.id as string;
}

/** New private list owned by the user (Duplicate and Load Preset). Original is never touched. */
export async function createTierListCopy(
  userId: string,
  src: { name: string; description: string; patch: string; data: TierData }
): Promise<string> {
  return saveTierList({
    userId,
    name: copyName(src.name, TIER_NAME_MAX),
    description: src.description,
    patch: src.patch,
    visibility: "private",
    data: src.data,
  });
}

export async function deleteTierList(id: string): Promise<void> {
  const { error } = await supabase.from("user_tier_lists").delete().eq("id", id);
  check(error);
}

export async function setTierListVisibility(id: string, visibility: Visibility): Promise<void> {
  const { error } = await supabase.from("user_tier_lists").update({ visibility }).eq("id", id);
  check(error);
}

/** Publish (private -> public) or push a new snapshot version of an already public list. */
export async function publishTierList(id: string): Promise<void> {
  const { error } = await supabase.rpc("publish_tier_list", { p_id: id });
  check(error);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCommunity = (r: any): CommunityTierListSummary => ({
  id: r.id,
  ownerId: r.owner_id,
  authorName: r.author_name ?? "",
  handle: r.handle ?? null,
  title: r.title,
  description: r.description ?? "",
  patch: r.patch ?? "",
  version: r.version ?? 1,
  heroCount: r.hero_count ?? 0,
  preview: Array.isArray(r.preview) ? r.preview.filter((x: unknown): x is string => typeof x === "string") : [],
  likes: r.like_count ?? 0,
  dislikes: r.dislike_count ?? 0,
  myValue: toReaction(r.my_value),
  publishedAt: r.published_at,
});

export async function listCommunityTierLists(args: {
  sort: CommunitySort;
  q: string;
  offset: number;
  limit: number;
}): Promise<CommunityTierListSummary[]> {
  const { data, error } = await supabase.rpc("list_community_tier_lists", {
    p_sort: args.sort,
    p_q: args.q.trim() || null,
    p_limit: args.limit,
    p_offset: args.offset,
  });
  check(error);
  return (data ?? []).map(toCommunity);
}

export async function getCommunityTierList(id: string): Promise<CommunityTierListSummary & { data: TierData }> {
  const { data, error } = await supabase.rpc("list_community_tier_lists", { p_only_id: id, p_limit: 1 });
  check(error);
  const row = data?.[0];
  if (!row) throw new Error("ไม่พบ Tier List นี้ (อาจถูกเอาออกจาก Community แล้ว)");
  return { ...toCommunity(row), data: parseTierData(row.data) };
}

/** value 0 removes the reaction. One row per (list, user): switching like <-> dislike is an upsert. */
export async function reactToTierList(listId: string, userId: string, value: Reaction): Promise<void> {
  if (value === 0) {
    const { error } = await supabase.from("community_tier_list_reactions").delete().eq("list_id", listId).eq("user_id", userId);
    check(error);
    return;
  }
  const { error } = await supabase
    .from("community_tier_list_reactions")
    .upsert({ list_id: listId, user_id: userId, value }, { onConflict: "list_id,user_id" });
  check(error);
}
