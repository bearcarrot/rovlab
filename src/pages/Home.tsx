import { useMemo, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Check,
  ListOrdered,
  NotebookPen,
  Scale,
  Sparkles,
  Swords,
} from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getDashboardInsights } from "@/services/insights";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/features/auth/AuthContext";
import { HeroCard } from "@/features/heroes/HeroCard";
import { HeroHelmetIcon } from "@/components/HeroHelmetIcon";
import { RANK_LABEL, useRank } from "@/lib/rank";
import { InsightCard } from "@/features/dashboard/InsightCard";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";

// ---------------------------------------------------------------------------
// Every destination below exists in App.tsx. Do not add a link here before the
// route exists (Draft Series, Community and a standalone Coach AI page are not
// routed yet, so they are intentionally not advertised).
// Icons match Sidebar / MobileDrawer so each tool looks the same everywhere.
// ---------------------------------------------------------------------------

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const TOOLS: { to: string; title: string; desc: string; icon: IconType }[] = [
  { to: "/tier-list", title: "Tier List", desc: "ดูว่าฮีโร่ตัวไหนแรงในเมต้านี้ พร้อมเหตุผลต่อฮีโร่", icon: ListOrdered },
  { to: "/counter-pick", title: "Counter Pick", desc: "เลือกฮีโร่ศัตรู แล้วดูว่าใครสวนได้และสวนอย่างไร", icon: Swords },
  { to: "/matchup", title: "Matchup", desc: "เทียบฮีโร่สองตัวในเลน ช่วงต้น กลาง ปลายเกม", icon: Scale },
  { to: "/heroes", title: "ฮีโร่ทั้งหมด", desc: "ค้นหาและกรองตาม Role / Lane ดูจุดแข็งจุดอ่อน", icon: HeroHelmetIcon },
];

const DRAFT_POINTS = [
  "ประเมินดาเมจกายภาพ/เวทของทีมที่เลือกไว้",
  "ดูแนวหน้า Crowd Control ความคล่องตัว ความคงทน และกำลังช่วงต้น-ปลายเกม",
  "แนะนำฮีโร่ตัวถัดไปพร้อมระดับดาว ความเสี่ยง และเหตุผล",
  "กดถามโค้ช AI ให้อธิบายเหตุผลของแต่ละตัวเลือก (ต้องล็อกอิน)",
];

const PREVIEW_METERS = [
  { label: "แนวหน้า", value: 30 },
  { label: "Crowd Control", value: 60 },
  { label: "ความคล่องตัว", value: 80 },
];

const PLACEHOLDER_PATCHES = new Set(["", "current", "N/A"]);

export function Home() {
  const { user, loading: authLoading } = useAuth();
  const heroes = useAsync(() => getHeroes(), []);
  const rank = useRank();

  // useAsync returns a new object every render, so memoize on the data itself.
  const data = heroes.status === "success" ? heroes.data : null;
  const meta = useMemo(() => {
    if (!data) return { topWinRate: [], mostBanned: [], patch: null };
    const withStats = data.filter((h) => h.stat.hasStats);
    const topWinRate = [...withStats].sort((a, b) => b.stat.winRate - a.stat.winRate).slice(0, 6);
    const mostBanned = [...withStats].sort((a, b) => b.stat.banRate - a.stat.banRate).slice(0, 6);
    const ref = withStats[0]?.stat;
    return {
      topWinRate,
      mostBanned,
      patch: ref && !PLACEHOLDER_PATCHES.has(ref.patch) ? ref.patch : null,
    };
  }, [data]);

  const metaLabel = [meta.patch ? `Patch ${meta.patch}` : null, RANK_LABEL[rank]].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      {/* 1. Product intro: text only, no hero image, so LCP is the headline */}
      <section className="space-y-4 pt-1">
        <p className="text-xs font-medium tracking-wide text-accent">RoV META &amp; DRAFT INTELLIGENCE</p>
        <h1 className="font-display text-2xl font-semibold leading-snug sm:text-3xl">
          ดราฟให้เหนือกว่า ด้วยข้อมูล ไม่ใช่การเดา
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-text-muted">
          วิเคราะห์องค์ประกอบทีม หาเคาน์เตอร์ และเลือกฮีโร่ให้เข้ากับแผนการเล่น
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/draft"
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg",
              FOCUS
            )}
          >
            เริ่มวิเคราะห์ Draft
          </Link>
          <Link
            to="/tier-list"
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg border border-border bg-bg-surface px-5 py-2.5 text-sm font-medium text-text hover:border-accent/40",
              FOCUS
            )}
          >
            ดู Tier List
          </Link>
        </div>
      </section>

      {/* 2. Tools: Draft Assistant leads, the rest follow in priority order */}
      <section aria-labelledby="tools-heading" className="space-y-3">
        <h2 id="tools-heading" className="font-display text-base font-semibold">เครื่องมือ</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/draft"
            className={cn(
              "flex min-h-11 gap-3 rounded-card border border-accent/50 bg-accent/5 p-4 hover:border-accent sm:col-span-2 lg:col-span-4",
              FOCUS
            )}
          >
            <NotebookPen className="mt-0.5 h-6 w-6 shrink-0 text-accent" strokeWidth={2} />
            <div>
              <p className="font-display text-base font-semibold leading-tight">Draft Assistant</p>
              <p className="mt-1 text-sm text-text-muted">
                เลือกฮีโร่ทีละช่อง ดูว่าทีมขาดอะไร แล้วรับคำแนะนำตัวถัดไปพร้อมเหตุผล
              </p>
            </div>
          </Link>
          {TOOLS.map(({ to, title, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex min-h-11 flex-col gap-2 rounded-card border border-border bg-bg-surface p-3.5 hover:border-accent/40",
                FOCUS
              )}
            >
              <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
              <div>
                <p className="font-display text-sm font-medium leading-tight">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. What Draft Assistant evaluates (static, no extra requests) */}
      <section aria-labelledby="draft-heading" className="grid gap-4 md:grid-cols-2 md:items-center">
        <div className="space-y-3">
          <h2 id="draft-heading" className="font-display text-base font-semibold">Draft Assistant ช่วยตัดสินใจอะไรได้บ้าง</h2>
          <ul className="space-y-2 text-sm text-text-muted">
            {DRAFT_POINTS.map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-faint">
            * คะแนนคำนวณแบบ Heuristic จาก Role ของฮีโร่ ยังไม่ใช่ข้อมูลระดับสกิล
          </p>
          <Link
            to="/draft"
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg border border-border bg-bg-surface px-4 py-2 text-sm font-medium hover:border-accent/40",
              FOCUS
            )}
          >
            ลองใช้ Draft Assistant
          </Link>
        </div>

        <div aria-hidden="true" className="space-y-3 rounded-card border border-border bg-bg-surface p-4">
          {PREVIEW_METERS.map((m) => (
            <div key={m.label}>
              <p className="mb-1 text-xs text-text-muted">{m.label}</p>
              <Progress value={m.value} />
            </div>
          ))}
          <p className="pt-1 text-[11px] text-text-faint">ภาพประกอบเพื่ออธิบายหน้าตา ไม่ใช่ผลวิเคราะห์จริง</p>
        </div>
      </section>

      {/* 4. Current meta */}
      <section aria-labelledby="meta-heading" className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="meta-heading" className="font-display text-base font-semibold">เมต้าตอนนี้</h2>
          {metaLabel && <span className="text-xs text-text-faint">{metaLabel}</span>}
        </div>
        <HeroRow title="Win Rate สูงสุด" state={heroes} heroes={meta.topWinRate} />
        <HeroRow title="ถูกแบนมากสุด" state={heroes} heroes={meta.mostBanned} metric="banRate" />
        {heroes.status === "success" && meta.topWinRate.length > 0 && (
          <p className="text-[11px] text-text-faint">
            * Win Rate/Ban Rate เป็นสถิติภาพรวมของฮีโร่ ไม่ใช่ผลแมตช์ตัวต่อตัว
          </p>
        )}
      </section>

      {/* 5. Personalized insights: mounted only when signed in, so guests make no extra request */}
      {!authLoading && user && <PersonalInsights />}

      {/* 6. More */}
      <section aria-labelledby="more-heading" className="space-y-3">
        <h2 id="more-heading" className="font-display text-base font-semibold">เรียนรู้และดูสถิติเพิ่ม</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoreLink to="/stats" icon={BarChart3} title="สถิติฮีโร่" desc="จัดอันดับ Win / Pick / Ban Rate แยกตาม Lane" />
          <MoreLink to="/learn" icon={BookOpen} title="คู่มือ" desc="บทเรียน Macro, การเล่นเลน และการดราฟต์ (กำลังทยอยเพิ่ม)" />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-text-faint">
          <Sparkles className="h-3.5 w-3.5" /> โค้ช AI อยู่ใน Draft Assistant ที่ปุ่ม &ldquo;ถามโค้ช AI&rdquo; บนการ์ดแนะนำ
        </p>
      </section>
    </div>
  );
}

function MoreLink({ to, icon: Icon, title, desc }: { to: string; icon: IconType; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-lg border border-border bg-bg-surface p-3 hover:border-accent/40",
        FOCUS
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
      <div>
        <p className="font-display text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-text-muted">{desc}</p>
      </div>
    </Link>
  );
}

function PersonalInsights() {
  const insights = useAsync(() => getDashboardInsights(), []);
  return (
    <section aria-labelledby="insights-heading">
      <h2 id="insights-heading" className="mb-3 font-display text-base font-semibold">ควรปรับปรุงอะไรก่อน</h2>
      {insights.status === "loading" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}
      {insights.status === "error" && <ErrorState message={insights.message} onRetry={insights.refetch} />}
      {insights.status === "success" && insights.data.length === 0 && (
        <EmptyState icon={Swords} title="ยังไม่มีข้อมูลให้วิเคราะห์" description="เล่นแมตช์แล้วเชื่อมข้อมูลเพื่อรับคำแนะนำเฉพาะตัว" />
      )}
      {insights.status === "success" && insights.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.data.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </section>
  );
}

type FetchState = { status: "loading" | "error" | "success"; refetch: () => void };

function HeroRow({
  title,
  state,
  heroes,
  metric = "winRate",
}: {
  title: string;
  state: FetchState;
  heroes: HeroSummary[];
  metric?: "winRate" | "banRate";
}) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-medium text-text-muted">{title}</h3>
      {state.status === "loading" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      )}
      {state.status === "error" && <ErrorState message="โหลดข้อมูลฮีโร่ไม่สำเร็จ" onRetry={state.refetch} />}
      {state.status === "success" && heroes.length === 0 && (
        <EmptyState icon={Swords} title="ยังไม่มีข้อมูลสถิติ" description="ข้อมูลจะแสดงเมื่อมีสถิติฮีโร่ในระบบ" />
      )}
      {state.status === "success" && heroes.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {heroes.map((h) => (
            <HeroCard key={h.id} hero={h} metric={metric} hideRoles />
          ))}
        </div>
      )}
    </div>
  );
}
