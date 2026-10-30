import { supabase } from "@/lib/supabase";
import type { ActivityEventType } from "@/services/activity";

// Admin Dashboard data. Every RPC checks is_admin() on the server; non-admins get a FORBIDDEN error.

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

// ---------- Dashboard extras (one RPC, read-only; see migration 20261030_admin_dashboard_users_insights.sql) ----------

export interface DailyPoint {
  day: string; // YYYY-MM-DD (Bangkok)
  users: number;
  activities: number;
}

export interface SimpleWindow {
  activeUsers: number;
  activities: number;
}

export interface FeatureUsers {
  feature: string; // ai_coach | draft | tier_list | hero | stats | matchup | counter_pick | match_analysis
  today: number;
  d7: number;
  d30: number;
}

export interface CreatedUsage {
  today: number;
  d7: number;
  d30: number;
  usersToday: number;
  usersD7: number;
  usersD30: number;
}

export interface DashboardExtras {
  daily: DailyPoint[];
  yesterday: SimpleWindow;
  prev7: SimpleWindow;
  featureUsers: FeatureUsers[];
  created: { combo: CreatedUsage; build: CreatedUsage };
  totals: {
    users: number;
    drafts: number;
    publicDrafts: number;
    tierLists: number;
    publicTierLists: number;
    combos: number;
    builds: number;
    matches: number;
  };
  moderation: {
    reportedVisible: number; // reported comments that are still visible
    reportedHidden: number; // reported comments already hidden (3 reports auto-hide)
    dislikedDrafts: number; // community drafts with >= 5 dislikes and more dislikes than likes
    dislikedTierLists: number;
    hiddenDrafts: number;
    hiddenTierLists: number;
    hiddenCombos: number;
    hiddenBuilds: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSimple = (w: any): SimpleWindow => ({ activeUsers: num(w?.active_users), activities: num(w?.activities) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCreated = (c: any): CreatedUsage => ({
  today: num(c?.today),
  d7: num(c?.d7),
  d30: num(c?.d30),
  usersToday: num(c?.users_today),
  usersD7: num(c?.users_d7),
  usersD30: num(c?.users_d30),
});

export async function getDashboardExtras(): Promise<DashboardExtras> {
  // RPC ใหม่ยังไม่อยู่ใน generated types จึงเรียกผ่าน cast เหมือน adminUsers.ts
  const { data, error } = await (
    supabase as unknown as { rpc: (f: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> }
  ).rpc("admin_dashboard_extras");
  if (error) throw new Error(error.message || "โหลดข้อมูลเพิ่มเติมไม่สำเร็จ");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (data ?? {}) as any;
  const t = d.totals ?? {};
  const m = d.moderation ?? {};
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    daily: ((d.daily ?? []) as any[]).map((p) => ({ day: String(p.day), users: num(p.users), activities: num(p.activities) })),
    yesterday: toSimple(d.yesterday),
    prev7: toSimple(d.prev7),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    featureUsers: ((d.feature_users ?? []) as any[]).map((f) => ({
      feature: String(f.feature),
      today: num(f.today),
      d7: num(f.d7),
      d30: num(f.d30),
    })),
    created: { combo: toCreated(d.created?.combo), build: toCreated(d.created?.build) },
    totals: {
      users: num(t.users),
      drafts: num(t.drafts),
      publicDrafts: num(t.public_drafts),
      tierLists: num(t.tier_lists),
      publicTierLists: num(t.public_tier_lists),
      combos: num(t.combos),
      builds: num(t.builds),
      matches: num(t.matches),
    },
    moderation: {
      reportedVisible: num(m.reported_visible),
      reportedHidden: num(m.reported_hidden),
      dislikedDrafts: num(m.disliked_drafts),
      dislikedTierLists: num(m.disliked_tier_lists),
      hiddenDrafts: num(m.hidden_drafts),
      hiddenTierLists: num(m.hidden_tier_lists),
      hiddenCombos: num(m.hidden_combos),
      hiddenBuilds: num(m.hidden_builds),
    },
  };
}
