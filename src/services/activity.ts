import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Lightweight activity tracking (public.user_activity_events) for the Admin Dashboard.
// Rules: meaningful feature actions only (no page_view / click / filter / hover / scroll), signed-in users only,
// tiny metadata, never block or break the main action. The DB whitelists event_type (see migration 20261007_user_activity_events).
// Call it fire-and-forget:  void trackActivity("ai_coach_used");

export type ActivityEventType =
  | "ai_coach_used"
  | "draft_created"
  | "draft_loaded"
  | "draft_shared"
  | "tier_list_created"
  | "tier_list_shared"
  | "hero_viewed"
  | "stats_viewed"
  | "matchup_viewed"
  | "counter_pick_used";

// ids / codes only: never put profile data or anything sensitive here (DB caps it at 512 bytes)
export type ActivityMetadata = Record<string, string | number | boolean>;

const seen = new Set<string>();

/**
 * Never throws and never needs awaiting. `once: true` records the same event+metadata at most once per page session
 * (use it for "viewed" / "loaded" style events so re-renders and re-opens don't inflate the numbers).
 */
export async function trackActivity(
  type: ActivityEventType,
  metadata?: ActivityMetadata,
  opts?: { once?: boolean }
): Promise<void> {
  try {
    if (!isSupabaseConfigured) return;
    if (opts?.once) {
      const key = `${type}:${JSON.stringify(metadata ?? {})}`;
      if (seen.has(key)) return;
      seen.add(key);
    }
    const { data } = await supabase.auth.getSession(); // reads the stored session, no extra network call
    const userId = data.session?.user.id;
    if (!userId) return; // anonymous users are not tracked
    const { error } = await supabase
      .from("user_activity_events")
      .insert({ user_id: userId, event_type: type, metadata: metadata ?? null });
    if (error && import.meta.env.DEV) console.warn("[activity] insert failed:", error.message);
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[activity] failed:", e);
  }
}
