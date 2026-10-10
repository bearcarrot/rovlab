import { useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { getActivitySummary, getRecentActivity } from "@/services/adminActivity";
import type { ActivitySummary, ActivityWindow } from "@/services/adminActivity";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { cn } from "@/lib/utils";

// event_type -> feature group (for the usage summary) + readable text (for Recent Activity)
const EVENT_META: Record<string, { feature: string; text: string }> = {
  ai_coach_used: { feature: "Coach Ai", text: "ใช้งาน Coach Ai" },
  draft_created: { feature: "Draft", text: "สร้าง Draft" },
  draft_loaded: { feature: "Draft", text: "เปิด Draft" },
  draft_shared: { feature: "Draft", text: "เผยแพร่ Draft" },
  tier_list_created: { feature: "Tier List", text: "สร้าง Tier List" },
  tier_list_shared: { feature: "Tier List", text: "เผยแพร่ Tier List" },
  hero_viewed: { feature: "Hero", text: "เปิดหน้าฮีโร่" },
  stats_viewed: { feature: "Stats", text: "เปิดหน้าสถิติ" },
  matchup_viewed: { feature: "Matchup", text: "เปิด Matchup" },
  counter_pick_used: { feature: "Counter Pick", text: "ใช้ Counter Pick" },
};

type Range = "today" | "d7" | "d30";
const RANGES: [Range, string][] = [
  ["today", "วันนี้"],
  ["d7", "7 วัน"],
  ["d30", "30 วัน"],
];

const TZ = "Asia/Bangkok";
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-bg-surface p-3.5">
      <p className="truncate text-xs text-text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function RangeCard({ title, w }: { title: string; w: ActivityWindow }) {
  const rows: [string, number][] = [
    ["Active Users", w.activeUsers],
    ["ผู้ใช้ใหม่", w.newUsers],
    ["กิจกรรมทั้งหมด", w.activities],
    ["Coach Ai", w.aiCoach],
    ["Draft", w.draft],
    ["Tier List", w.tierList],
  ];
  return (
    <div className="rounded-card border border-border bg-bg-surface p-4">
      <p className="mb-2 font-display text-sm font-semibold">{title}</p>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <dt className="text-text-muted">{label}</dt>
            <dd className="font-medium">{v.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FeatureUsage({ summary }: { summary: ActivitySummary }) {
  const [range, setRange] = useState<Range>("d7");

  const totals = new Map<string, number>();
  for (const f of summary.features) {
    const feature = EVENT_META[f.eventType]?.feature ?? String(f.eventType);
    totals.set(feature, (totals.get(feature) ?? 0) + f[range]);
  }
  const rows = [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = rows.length > 0 ? rows[0][1] : 0;

  return (
    <section className="space-y-2">
      {/* จอแคบ: หัวข้อกับชิปช่วงเวลาตกลงบรรทัดใหม่ได้ ไม่ล้นจอ */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Feature Usage</h2>
        <div className="flex gap-1">
          {RANGES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={cn(
                "min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium",
                range === k ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border py-6 text-center text-sm text-text-faint">
          ยังไม่มีกิจกรรมในช่วงนี้
        </p>
      ) : (
        <div className="space-y-2 rounded-card border border-border bg-bg-surface p-4">
          {rows.map(([feature, n]) => (
            <div key={feature}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{feature}</span>
                <span className="text-text-muted">{n.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
                <div className="h-full rounded-full bg-accent" style={{ width: `${max > 0 ? (n / max) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminDashboard() {
  const summaryQ = useAsync(() => getActivitySummary(), []);
  const recentQ = useAsync(() => getRecentActivity(30), []);

  function refresh() {
    summaryQ.refetch();
    recentQ.refetch();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-xs text-text-faint">นับจากกิจกรรมของผู้ใช้ที่ล็อกอินเท่านั้น · วันนี้ = วันตามเวลาไทย · เก็บย้อนหลังเป้าหมาย 90 วัน</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="รีเฟรช"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {summaryQ.status === "loading" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}
      {summaryQ.status === "error" && <ErrorState message={summaryQ.message} onRetry={summaryQ.refetch} />}
      {summaryQ.status === "success" && (
        <>
          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">วันนี้</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Active Users" value={summaryQ.data.today.activeUsers} />
              <StatCard label="ผู้ใช้ใหม่" value={summaryQ.data.today.newUsers} />
              <StatCard label="กิจกรรม" value={summaryQ.data.today.activities} />
              <StatCard label="Coach Ai" value={summaryQ.data.today.aiCoach} />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <RangeCard title="7 วันล่าสุด" w={summaryQ.data.d7} />
            <RangeCard title="30 วันล่าสุด" w={summaryQ.data.d30} />
          </section>

          <FeatureUsage summary={summaryQ.data} />
        </>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">Recent Activity</h2>
        {recentQ.status === "loading" && (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        )}
        {recentQ.status === "error" && <ErrorState message={recentQ.message} onRetry={recentQ.refetch} />}
        {recentQ.status === "success" && recentQ.data.length === 0 && (
          <EmptyState icon={Activity} title="ยังไม่มีกิจกรรม" description="กิจกรรมจะขึ้นที่นี่เมื่อผู้ใช้เริ่มใช้งานฟีเจอร์ต่าง ๆ" />
        )}
        {recentQ.status === "success" && recentQ.data.length > 0 && (
          <ul className="divide-y divide-border rounded-card border border-border bg-bg-surface">
            {recentQ.data.map((a) => {
              const meta = EVENT_META[a.eventType];
              const who = a.displayName || a.handle || `ผู้ใช้ #${a.userId.slice(0, 6)}`;
              const extra = a.metadata
                ? Object.entries(a.metadata).map(([k, v]) => `${k}: ${String(v).slice(0, 12)}`).join(" · ")
                : "";
              return (
                <li key={a.id} className="flex gap-3 px-3 py-2.5">
                  <span className="w-24 shrink-0 text-xs text-text-faint">{fmtTime(a.createdAt)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm">
                      <span className="font-medium">{meta?.feature ?? a.eventType}</span>
                      <span className="text-text-muted"> · {who} {meta ? meta.text : ""}</span>
                    </p>
                    {extra && <p className="truncate text-[11px] text-text-faint">{extra}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
