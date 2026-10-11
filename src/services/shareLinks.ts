import { supabase } from "@/lib/supabase";
import { trackActivity } from "@/services/activity";

// Helpers for share links: find / create the Community row (its id is what the link carries).
// Reads go through the public SELECT policy on community_*; publishing goes through the existing
// publish_draft / publish_tier_list RPCs (which return the Community row id). No schema change.

function check(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || "เกิดข้อผิดพลาด");
}

/** Community id of a saved draft that is already published, or null. */
export async function communityDraftIdFor(sourceDraftId: string): Promise<string | null> {
  const { data, error } = await supabase.from("community_drafts").select("id").eq("source_draft_id", sourceDraftId).maybeSingle();
  check(error);
  return (data?.id as string | undefined) ?? null;
}

/** Community id of a saved tier list that is already published, or null. */
export async function communityTierListIdFor(sourceId: string): Promise<string | null> {
  const { data, error } = await supabase.from("community_tier_lists").select("id").eq("source_id", sourceId).maybeSingle();
  check(error);
  return (data?.id as string | undefined) ?? null;
}

/** Publish (private -> public) or push a new version, and return the Community id. */
export async function publishDraftForLink(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("publish_draft", { p_id: id });
  check(error);
  if (typeof data !== "string") throw new Error("เผยแพร่ไม่สำเร็จ");
  void trackActivity("draft_shared", { draft_id: id });
  return data;
}

export async function publishTierListForLink(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("publish_tier_list", { p_id: id });
  check(error);
  if (typeof data !== "string") throw new Error("เผยแพร่ไม่สำเร็จ");
  void trackActivity("tier_list_shared", { tier_list_id: id });
  return data;
}
