import { useState } from "react";
import { Activity, RefreshCw, ShieldAlert } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { getActivitySummary, getDashboardExtras, getRecentActivity } from "@/services/adminActivity";
import type {
  ActivitySummary,
  ActivityWindow,
  CreatedUsage,
  DailyPoint,
  DashboardExtras,
  SimpleWindow,
} from "@/services/adminActivity";
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
  match_analysis_attempted: { feature: "Match Analysis", text: "ส่งรูปวิเคราะห์แมตช์" },
  match_saved: { feature: "Match Analysis", text: "บันทึกแมตช์" },
};

// feature group key from admin_dashboard_extras (SQL) -> same label as EVENT_META[...].feature
const FEATURE_LABEL: Record<string, string> = {
  ai_coach: "Coach Ai",
  draft: "Draft",
  tier_list: "Tier List",
  hero: "Hero",
  stats: "Stats",
  matchup: "Matchup",
  counter_pick: "Counter Pick",
  match_analysis: "Match Analysis",
};

type Range = "today" | "d7" | "d30";
const RANGES: [Range, string][] = [
  ["today", "วันนี้"],
  ["d7", "7 วัน"],
  ["d30", "30 วัน"],
];

export type DashboardTarget = "users" | "community" | "combo";

const TZ = "Asia/Bangkok";
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: TZ });

// เทียบกับช่วงก่อนหน้า: ไม่มีฐานเปรียบเทียบ (0) = ไม่แสดงเปอร์เซ็นต์ ไม่หารศูนย์
function fmtDelta(cur: number, prev: number): string {
  if (prev <= 0) return "";
  const p = Math.round(((cur - prev) / prev) * 100);
  return `(${p > 0 ? "+" : ""}${p}%)`;
}

// metadata ที่รู้ความหมายแน่นอน (ok / edited จาก activity.ts) แสดงเป็นข้อความ ที่เหลือแสดง key: value เหมือนเดิม
function fmtMeta(m: Record<string, unknown> | null): string {
  if (!m) return "";
  return Object.entries(m)
    .map(([k, v]) => {
      if (k === "ok" && typeof v === "boolean") return v ? "สำเร็จ" : "ไม่สำเร็จ";
      if (k === "edited" && typeof v === "boolean") return v ? "แก้ผล OCR ก่อนบันทึก" : "ไม่ได้แก้ผล OCR";
      return `${k}: ${String(v).slice(0, 16)}`;
    })
    .join(" · ");
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-bg-surface p-3.5">
      <p className="truncate text-xs text-text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value.toLocaleString()}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-text-faint">{hint}</p>}
    </div>
  );
}

function RangeCard({ title, w, prev }: { title: string; w: ActivityWindow; prev?: SimpleWindow }) {
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
      {prev && (
        <p className="mt-2 border-t border-border pt-2 text-[11px] text-text-faint">
          เทียบ 7 วันก่อนหน้า: Active {prev.activeUsers.toLocaleString()} {fmtDelta(w.activeUsers, prev.activeUsers)} · กิจกรรม{" "}
          {prev.activities.toLocaleString()} {fmtDelta(w.activities, prev.activities)}
        </p>
      )}
    </div>
  );
}

// กราฟแท่ง 14 วัน ใช้ div ล้วน ไม่เพิ่ม dependency
function TrendChart({ daily }: { daily: DailyPoint[] }) {
  const [metric, setMetric] = useState<"activities" | "users">("activities");
  if (daily.length === 0) return null;
  const values = daily.map((p) => p[metric]);
  const max = Math.max(1, ...values);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const peak = daily.reduce((best, p) => (p[metric] > best[metric] ? p : best), daily[0]);
  const label = metric === "activities" ? "กิจกรรม" : "Active Users";
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">แนวโน้ม 14 วัน</h2>
        <div className="flex gap-1">
          {(
            [
              ["activities", "กิจกรรม"],
              ["users", "Active Users"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              className={cn(
                "min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium",
                metric === k ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-card border border-border bg-bg-surface p-4">
        <div
          role="img"
          aria-label={`${label} 14 วันล่าสุด เฉลี่ย ${avg} ต่อวัน สูงสุด ${max} เมื่อ ${fmtDay(peak.day)}`}
          className="flex h-28 items-end gap-1"
        >
          {daily.map((p) => (
            <div
              key={p.day}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${fmtDay(p.day)} · Active ${p.users} · กิจกรรม ${p.activities}`}
            >
              <div
                className="w-full rounded-t bg-accent/80"
                style={{ height: `${(p[metric] / max) * 100}%`, minHeight: p[metric] > 0 ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-text-faint">
          <span>{fmtDay(daily[0].day)}</span>
          <span>{fmtDay(daily[daily.length - 1].day)}</span>
        </div>
        <p className="mt-2 text-[11px] text-text-faint">
          เฉลี่ย {avg.toLocaleString()} ต่อวัน · สูงสุด {max.toLocaleString()} ({fmtDay(peak.day)})
        </p>
      </div>
    </section>
  );
}

function AttentionRow({ label, hint, n, onOpen }: { label: string; hint?: string; n: number; onOpen?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-[11px] text-text-faint">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-display text-lg font-semibold">{n.toLocaleString()}</span>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="min-h-[36px] rounded-lg border border-border px-3 text-xs text-text-muted hover:text-text"
          >
            เปิด
          </button>
        )}
      </div>
    </li>
  );
}

type Item = { label: string; hint?: string; n: number; to: DashboardTarget };

function ModerationSection({ m, onOpen }: { m: DashboardExtras["moderation"]; onOpen?: (t: DashboardTarget) => void }) {
  const DISLIKE_HINT = "ดิสไลค์ตั้งแต่ 5 และมากกว่าไลค์";
  const review: Item[] = [
    { label: "คอมเมนต์ที่ถูกรายงาน (ยังแสดงอยู่)", hint: "ใช้ตัวกรอง “ถูกรายงาน” ในแท็บผู้ใช้", n: m.reportedVisible, to: "users" },
    { label: "Community Draft ที่ถูกดิสไลค์", hint: DISLIKE_HINT, n: m.dislikedDrafts, to: "community" },
    { label: "Community Tier List ที่ถูกดิสไลค์", hint: DISLIKE_HINT, n: m.dislikedTierLists, to: "community" },
  ].filter((r) => r.n > 0);
  const hidden: Item[] = [
    { label: "คอมเมนต์ที่ถูกซ่อน (มีรายงาน)", n: m.reportedHidden, to: "users" },
    { label: "Community Draft ที่ซ่อนอยู่", n: m.hiddenDrafts, to: "community" },
    { label: "Community Tier List ที่ซ่อนอยู่", n: m.hiddenTierLists, to: "community" },
    { label: "Combo ที่ซ่อนอยู่", n: m.hiddenCombos, to: "combo" },
    { label: "Item Build ที่ซ่อนอยู่", n: m.hiddenBuilds, to: "community" },
  ].filter((r) => r.n > 0);

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
        <ShieldAlert className="h-4 w-4 text-accent" aria-hidden /> รอตรวจ / ถูกซ่อน
      </h2>
      {review.length === 0 ? (
        <p className="rounded-card border border-dashed border-border py-4 text-center text-sm text-text-faint">ไม่มีรายการที่ต้องตรวจ</p>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-bg-surface">
          {review.map((r) => (
            <AttentionRow key={r.label} label={r.label} hint={r.hint} n={r.n} onOpen={onOpen ? () => onOpen(r.to) : undefined} />
          ))}
        </ul>
      )}
      {hidden.length > 0 && (
        <ul className="divide-y divide-border rounded-card border border-border bg-bg-surface">
          {hidden.map((r) => (
            <AttentionRow key={r.label} label={r.label} n={r.n} onOpen={onOpen ? () => onOpen(r.to) : undefined} />
          ))}
        </ul>
      )}
      <p className="text-[11px] text-text-faint">
        Draft / Tier List / Combo / Build ยังไม่มีระบบให้ผู้ใช้รายงาน จึงใช้จำนวนดิสไลค์เป็นสัญญาณแทนสำหรับ Draft และ Tier List
      </p>
    </section>
  );
}

function TotalsSection({ t }: { t: DashboardExtras["totals"] }) {
  const cells: [string, number, string?][] = [
    ["ผู้ใช้ทั้งหมด", t.users],
    ["Draft", t.drafts, `เผยแพร่ ${t.publicDrafts.toLocaleString()}`],
    ["Tier List", t.tierLists, `เผยแพร่ ${t.publicTierLists.toLocaleString()}`],
    ["Combo ของผู้ใช้", t.combos],
    ["Item Build", t.builds],
    ["แมตช์ที่บันทึก", t.matches],
  ];
  return (
    <section className="space-y-2">
      <h2 className="font-display text-base font-semibold">ข้อมูลในระบบ</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cells.map(([label, v, hint]) => (
          <StatCard key={label} label={label} value={v} hint={hint} />
        ))}
      </div>
    </section>
  );
}

type UsageRow = { name: string; n: number; users: number | null };

function FeatureUsage({ summary, extras }: { summary: ActivitySummary; extras: DashboardExtras | null }) {
  const [range, setRange] = useState<Range>("d7");

  const totals = new Map<string, number>();
  for (const f of summary.features) {
    const feature = EVENT_META[f.eventType]?.feature ?? String(f.eventType);
    totals.set(feature, (totals.get(feature) ?? 0) + f[range]);
  }
  const usersBy = new Map<string, number>();
  if (extras) {
    for (const f of extras.featureUsers) usersBy.set(FEATURE_LABEL[f.feature] ?? f.feature, f[range]);
  }
  const rows: UsageRow[] = [...totals.entries()].map(([name, n]) => ({ name, n, users: extras ? (usersBy.get(name) ?? 0) : null }));

  // Combo / Item Build นับจากตารางจริง (ไม่มี event ติดตามเพิ่ม จึงไม่เพิ่มภาระการเขียนฐานข้อมูล)
  if (extras) {
    const pick = (c: CreatedUsage): [number, number] =>
      range === "today" ? [c.today, c.usersToday] : range === "d7" ? [c.d7, c.usersD7] : [c.d30, c.usersD30];
    const [cn, cu] = pick(extras.created.combo);
    const [bn, bu] = pick(extras.created.build);
    rows.push({ name: "Combo (สร้างใหม่)", n: cn, users: cu }, { name: "Item Build (สร้างใหม่)", n: bn, users: bu });
  }
  const shown = rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  const max = shown.length > 0 ? shown[0].n : 0;

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
      {shown.length === 0 ? (
        <p className="rounded-card border border-dashed border-border py-6 text-center text-sm text-text-faint">
          ยังไม่มีกิจกรรมในช่วงนี้
        </p>
      ) : (
        <div className="space-y-2 rounded-card border border-border bg-bg-surface p-4">
          {shown.map((r) => (
            <div key={r.name}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span>{r.name}</span>
                <span className="text-text-muted">
                  {r.n.toLocaleString()} ครั้ง{r.users != null ? ` · ${r.users.toLocaleString()} คน` : ""}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
                <div className="h-full rounded-full bg-accent" style={{ width: `${max > 0 ? (r.n / max) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminDashboard({ onOpen }: { onOpen?: (target: DashboardTarget) => void }) {
  const summaryQ = useAsync(() => getActivitySummary(), []);
  const recentQ = useAsync(() => getRecentActivity(30), []);
  // ข้อมูลเสริมโหลดครั้งเดียวตอนเปิดแท็บ (RPC เดียว ไม่ polling) ถ้าล้มเหลวส่วนหลักของ Dashboard ยังใช้ได้
  const extrasQ = useAsync(() => getDashboardExtras(), []);
  const extras = extrasQ.status === "success" ? extrasQ.data : null;

  function refresh() {
    summaryQ.refetch();
    recentQ.refetch();
    extrasQ.refetch();
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
        <section className="space-y-2">
          <h2 className="font-display text-base font-semibold">วันนี้</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Active Users"
              value={summaryQ.data.today.activeUsers}
              hint={extras ? `เมื่อวาน ${extras.yesterday.activeUsers.toLocaleString()}` : undefined}
            />
            <StatCard label="ผู้ใช้ใหม่" value={summaryQ.data.today.newUsers} />
            <StatCard
              label="กิจกรรม"
              value={summaryQ.data.today.activities}
              hint={extras ? `เมื่อวาน ${extras.yesterday.activities.toLocaleString()}` : undefined}
            />
            <StatCard label="Coach Ai" value={summaryQ.data.today.aiCoach} />
          </div>
        </section>
      )}

      {extrasQ.status === "loading" && <Skeleton className="h-32" />}
      {extrasQ.status === "error" && <ErrorState message={extrasQ.message} onRetry={extrasQ.refetch} />}
      {extras && <ModerationSection m={extras.moderation} onOpen={onOpen} />}
      {extras && <TrendChart daily={extras.daily} />}

      {summaryQ.status === "success" && (
        <>
          <section className="grid gap-3 md:grid-cols-2">
            <RangeCard title="7 วันล่าสุด" w={summaryQ.data.d7} prev={extras?.prev7} />
            <RangeCard title="30 วันล่าสุด" w={summaryQ.data.d30} />
          </section>

          <FeatureUsage summary={summaryQ.data} extras={extras} />
        </>
      )}

      {extras && <TotalsSection t={extras.totals} />}

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
              const extra = fmtMeta(a.metadata);
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
