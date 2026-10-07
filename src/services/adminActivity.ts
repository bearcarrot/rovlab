import { supabase } from "@/lib/supabase";
import type { ActivityEventType } from "@/services/activity";

// Admin Dashboard data. Both RPCs check is_admin() on the server; non-admins get a FORBIDDEN error.

export interface ActivityWindow {
  activeUsers: number; // distinct users with >= 1 event
  newUsers: number; // profiles created in the window
  activities: number; // total events
  aiCoach: number;
  draft: number;
  tierList: number;
}

export interface FeatureCount {
  eventType: ActivityEventType | string;
  today: number;
  d7: number;
  d30: number;
}

export interface ActivitySummary {
  today: ActivityWindow;
  d7: ActivityWindow;
  d30: ActivityWindow;
  features: FeatureCount[];
}

export interface RecentActivity {
  id: string;
  createdAt: string;
  eventType: ActivityEventType | string;
  metadata: Record<string, unknown> | null;
  userId: string;
  displayName: string | null;
  handle: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toWindow = (w: any): ActivityWindow => ({
  activeUsers: num(w?.active_users),
  newUsers: num(w?.new_users),
  activities: num(w?.activities),
  aiCoach: num(w?.ai_coach),
  draft: num(w?.draft),
  tierList: num(w?.tier_list),
});

export async function getActivitySummary(): Promise<ActivitySummary> {
  const { data, error } = await supabase.rpc("admin_activity_summary");
  if (error) throw new Error(error.message || "โหลดข้อมูลไม่สำเร็จ");
  return {
    today: toWindow(data?.today),
    d7: toWindow(data?.d7),
    d30: toWindow(data?.d30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    features: ((data?.features ?? []) as any[]).map((f) => ({
      eventType: String(f.event_type),
      today: num(f.today),
      d7: num(f.d7),
      d30: num(f.d30),
    })),
  };
}

export async function getRecentActivity(limit = 30): Promise<RecentActivity[]> {
  const { data, error } = await supabase.rpc("admin_recent_activity", { p_limit: limit });
  if (error) throw new Error(error.message || "โหลดกิจกรรมล่าสุดไม่สำเร็จ");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    eventType: r.event_type,
    metadata: r.metadata && typeof r.metadata === "object" ? r.metadata : null,
    userId: r.user_id,
    displayName: r.display_name ?? null,
    handle: r.handle ?? null,
  }));
}
