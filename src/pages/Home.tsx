import { useMemo, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Ban,
  Check,
  Flame,
  Hammer,
  Library,
  ListOrdered,
  NotebookPen,
  Scale,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getCuratedTiers } from "@/services/tierlist";
import { useAsync } from "@/hooks/useAsync";
import { HeroHelmetIcon } from "@/components/HeroHelmetIcon";
import { RANK_LABEL, useRank } from "@/lib/rank";
import { StatBarRow, type StatTone } from "@/features/stats/StatBarRow";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { MyMatchesCard } from "@/features/matches/MyMatchesCard";
import { DraftPreviewSlot } from "@/features/draft/DraftPreviewSlot";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/siteConfig";
import type { HeroSummary, Tier } from "@/types/hero";

// ---------------------------------------------------------------------------
// Every destination below exists in App.tsx. Do not add a link here before the
// route exists (Draft Series, Community and a standalone Coach Ai page are not
// routed yet, so they are intentionally not advertised).
// Icons match Sidebar / MobileDrawer so each tool looks the same everywhere.
//
// Visual layer: all effects are CSS-only (see "Home redesign" in index.css) and
// colours come from the existing palette; no new dependency.
// ---------------------------------------------------------------------------

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

// สีเรืองแสง "R G B" ตรงกับ tailwind.config.ts (accent / rift / win / loss / tier)
const GLOW = {
  gold: "232 163 61",
  blue: "76 141 255",
  green: "61 214 140",
  red: "229 72 77",
  orange: "249 115 22",
  sky: "59 130 246",
  tierSp: "220 38 38",
  tierS: "249 115 22",
} as const;

const glow = (rgb: string) => ({ "--glow": rgb }) as CSSProperties;

// ลำดับเดียวกับ Sidebar / MobileDrawer (Draft Assistant เป็นการ์ดใหญ่ด้านบนแยกต่างหาก)
const TOOLS: { to: string; title: string; desc: string; icon: IconType; glow: string }[] = [
  { to: "/tier-list", title: "Tier List", desc: "ดูว่าฮีโร่ตัวไหนแรงในเมต้านี้ พร้อมเหตุผลต่อฮีโร่", icon: ListOrdered, glow: GLOW.gold },
  { to: "/counter-pick", title: "Counter Pick", desc: "เลือกฮีโร่ศัตรู แล้วดูว่าใครสวนได้และสวนอย่างไร", icon: Swords, glow: GLOW.red },
  { to: "/matchup", title: "Matchup", desc: "เทียบฮีโร่สองตัวในเลน ช่วงต้น กลาง ปลายเกม", icon: Scale, glow: GLOW.blue },
  { to: "/heroes", title: "ฮีโร่ทั้งหมด", desc: "ค้นหาและกรองตาม Role / Lane ดูจุดแข็งจุดอ่อน", icon: HeroHelmetIcon, glow: GLOW.green },
  { to: "/build", title: "Item Build", desc: "เลือกฮีโร่เพื่อดูบิลด์แนะนำพร้อมเหตุผล", icon: Hammer, glow: GLOW.orange },
  { to: "/game-data", title: "คลังข้อมูลเกม", desc: "รวมไอเทม รูน และข้อมูลเกมให้ค้นหาได้", icon: Library, glow: GLOW.sky },
];

const DRAFT_POINTS = [
  "ประเมินดาเมจกายภาพ/เวทของทีมที่เลือกไว้",
  "ดูแนวหน้า Crowd Control ความคล่องตัว ความคงทน และกำลังช่วงต้น-ปลายเกม",
  "แนะนำฮีโร่ตัวถัดไปพร้อมระดับดาว ความเสี่ยง และเหตุผล",
  "กดถาม Coach Ai ให้อธิบายเหตุผลของแต่ละตัวเลือก (ต้องล็อกอิน)",
];

const PLACEHOLDER_PATCHES = new Set(["", "current", "N/A"]);

// สแนปช็อตหน้าสถิติ: โชว์แค่ 6 อันดับแรกของแต่ละตัวชี้วัด
const SNAPSHOT_SIZE = 6;
// แถว Tier: โชว์ S+ และ S อย่างละสูงสุด 11 ตัว (+ ปุ่ม "+N" ไปหน้า Tier List) ไอคอนเล็กกว่าหน้า Tier List
const TOP_TIER_MAX = 11;
const TOP_TIERS: Tier[] = ["S+", "S"];
const TIER_GLOW: Record<string, string> = { "S+": GLOW.tierSp, S: GLOW.tierS };

// ฮีโร่บนภาพประกอบ (โมเสกใน Hero + แถบเลื่อน) — ตกแต่งอย่างเดียว
const MOSAIC_SIZE = 9;
const MARQUEE_SIZE = 20;

export function Home() {
  const heroes = useAsync(() => getHeroes(), []);
  const rank = useRank();
  // Tier ที่ทีมงานจัด (ลิสต์รวมทุกเลน) — ถ้ายังไม่มี/อ่านไม่ได้ ใช้ tier จากสถิติเหมือนหน้า Tier List
  const curated = useAsync(() => getCuratedTiers(rank, null), [rank]);

  // useAsync returns a new object every render, so memoize on the data itself.
  const data = heroes.status === "success" ? heroes.data : null;
  const curatedTiers = curated.status === "success" ? curated.data : null;
  const curatedLoading = curated.status === "loading";

  const meta = useMemo(() => {
    if (!data) return { topWinRate: [], topPickRate: [], mostBanned: [], patch: null };
    const withStats = data.filter((h) => h.stat.hasStats);
    const top = (key: "winRate" | "pickRate" | "banRate") =>
      [...withStats].sort((a, b) => b.stat[key] - a.stat[key]).slice(0, SNAPSHOT_SIZE);
    const ref = withStats[0]?.stat;
    return {
      topWinRate: top("winRate"),
      topPickRate: top("pickRate"),
      mostBanned: top("banRate"),
      patch: ref && !PLACEHOLDER_PATCHES.has(ref.patch) ? ref.patch : null,
    };
  }, [data]);

  // ฮีโร่ Tier S+ / S เรียง A–Z (ไม่เรียงตามความแรง เหมือนหน้า Tier List)
  const topTiers = useMemo(() => {
    if (!data || curatedLoading) return null;
    return TOP_TIERS.map((tier) => ({
      tier,
      heroes: data
        .filter((h) => (curatedTiers ? curatedTiers.get(h.id) : h.stat.hasStats ? h.stat.tier : undefined) === tier)
        .sort((a, b) => a.name.localeCompare(b.name, "en")),
    }));
  }, [data, curatedTiers, curatedLoading]);

  // ฮีโร่ที่มีรูป เรียงตาม Pick Rate เอาไว้ทำภาพประกอบ (ไม่ใช่ข้อมูลวิเคราะห์)
  const showcase = useMemo(() => {
    if (!data) return [];
    return data
      .filter((h) => h.icon)
      .sort((a, b) => (b.stat.hasStats ? b.stat.pickRate : 0) - (a.stat.hasStats ? a.stat.pickRate : 0))
      .slice(0, MARQUEE_SIZE);
  }, [data]);

  const topTierCount = topTiers ? topTiers.reduce((n, g) => n + g.heroes.length, 0) : null;
  const metaLabel = [meta.patch ? `Patch ${meta.patch}` : null, RANK_LABEL[rank]].filter(Boolean).join(" · ");

  return (
    <div className="space-y-12 pb-4">
      <Hero
        metaLabel={metaLabel}
        heroCount={data ? data.length : null}
        topTierCount={topTierCount}
        patch={meta.patch}
        rankLabel={RANK_LABEL[rank]}
        mosaic={showcase.slice(0, MOSAIC_SIZE)}
      />

      <HeroMarquee heroes={showcase} />

      {/* 2. Tools: Draft Assistant leads, the rest follow in the same order as the Sidebar */}
      <section aria-labelledby="tools-heading" className="space-y-4">
        <SectionHeading id="tools-heading" index="01" title="เครื่องมือ" sub="ทุกอย่างที่ต้องใช้ตั้งแต่ดราฟต์จนจบเกม" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/draft"
            style={glow(GLOW.gold)}
            className={cn(
              "home-glow group relative flex min-h-11 items-center gap-4 overflow-hidden rounded-card border border-accent/50 bg-gradient-to-br from-accent/15 via-bg-surface to-bg-surface p-5 sm:col-span-2 lg:col-span-3",
              FOCUS
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl transition-opacity group-hover:opacity-100"
            />
            <span className="home-glow-tile relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
              <NotebookPen className="h-7 w-7" strokeWidth={2} />
            </span>
            <div className="relative min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-semibold leading-tight">Draft Assistant</p>
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-fg">
                  แนะนำ
                </span>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                เลือกฮีโร่ทีละช่อง ดูว่าทีมขาดอะไร แล้วรับคำแนะนำตัวถัดไปพร้อมเหตุผล
              </p>
            </div>
            <ArrowRight className="relative hidden h-5 w-5 shrink-0 text-accent transition-transform group-hover:translate-x-1 sm:block" />
          </Link>

          {TOOLS.map(({ to, title, desc, icon: Icon, glow: rgb }) => (
            <Link
              key={to}
              to={to}
              style={glow(rgb)}
              className={cn(
                "home-glow group flex min-h-11 flex-col gap-3 rounded-card border border-border bg-bg-surface p-4",
                FOCUS
              )}
            >
              <div className="flex items-center justify-between">
                <span className="home-glow-tile flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <ArrowRight className="h-4 w-4 -translate-x-1 text-text-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <div>
                <p className="font-display text-sm font-semibold leading-tight">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. What Draft Assistant evaluates. Right column: static preview, swapped for the most-liked community draft once it scrolls near the viewport */}
      <section
        aria-labelledby="draft-heading"
        className="home-glass relative grid gap-6 overflow-hidden rounded-3xl p-5 sm:p-7 md:grid-cols-2 md:items-center"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rift/10 blur-3xl"
        />
        <div className="relative space-y-4">
          <SectionHeading
            id="draft-heading"
            index="02"
            title="Draft Assistant ช่วยตัดสินใจอะไรได้บ้าง"
          />
          <ul className="space-y-3 text-sm text-text-muted">
            {DRAFT_POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/40">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
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
              "home-cta inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-accent-fg",
              FOCUS
            )}
          >
            ลองใช้ Draft Assistant <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative">
          <DraftPreviewSlot heroes={data ?? []} />
        </div>
      </section>

      {/* 4. Current meta: snapshot of Tier List (S+ / S) and the Stats page (top 6 each) */}
      <section aria-labelledby="meta-heading" className="space-y-6">
        <SectionHeading
          id="meta-heading"
          index="03"
          title="เมต้าตอนนี้"
          sub="สแนปช็อตจากหน้า Tier List และสถิติฮีโร่"
          aside={metaLabel ? <MetaPill>{metaLabel}</MetaPill> : null}
        />

        <TopTierRows
          loading={heroes.status === "loading" || curatedLoading}
          error={heroes.status === "error"}
          groups={topTiers}
          curated={curatedTiers !== null}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatSnapshot
            title="Win Rate สูงสุด"
            icon={Trophy}
            rgb={GLOW.green}
            state={heroes}
            heroes={meta.topWinRate}
            metric="winRate"
            tone="success"
          />
          <StatSnapshot
            title="Pick Rate สูงสุด"
            icon={Flame}
            rgb={GLOW.gold}
            state={heroes}
            heroes={meta.topPickRate}
            metric="pickRate"
          />
          <StatSnapshot
            title="Ban Rate สูงสุด"
            icon={Ban}
            rgb={GLOW.red}
            hint="ควรแบน"
            state={heroes}
            heroes={meta.mostBanned}
            metric="banRate"
            tone="danger"
          />
        </div>
        {heroes.status === "success" && meta.topWinRate.length > 0 && (
          <p className="text-[11px] text-text-faint">
            * Win Rate/Pick Rate/Ban Rate เป็นสถิติภาพรวมของฮีโร่ ไม่ใช่ผลแมตช์ตัวต่อตัว
          </p>
        )}
      </section>

      {/* 5. More */}
      <section aria-labelledby="more-heading" className="space-y-4">
        <SectionHeading id="more-heading" index="04" title="เรียนรู้และดูสถิติเพิ่ม" />
        <div className="grid gap-3 sm:grid-cols-2">
          <MoreLink to="/stats" icon={BarChart3} rgb={GLOW.gold} title="สถิติฮีโร่" desc="จัดอันดับ Win / Pick / Ban Rate แยกตาม Lane" />
          <MoreLink to="/learn" icon={BookOpen} rgb={GLOW.blue} title="คู่มือ" desc="บทเรียน Macro, การเล่นเลน และการดราฟต์ (กำลังทยอยเพิ่ม)" />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-text-faint">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> Coach Ai อยู่ใน Draft Assistant ที่ปุ่ม &ldquo;ถาม Coach Ai&rdquo; บนการ์ดแนะนำ
        </p>
      </section>

      {/* 6. ปิดท้ายด้วย CTA */}
      <section
        aria-label="เริ่มใช้งาน"
        className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/20 via-bg-surface to-bg-surface p-6 text-center sm:p-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/30 blur-3xl"
        />
        <div className="relative space-y-4">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">
            ดราฟต์ให้ขาด <span className="home-gold-text">ชนะตั้งแต่ก่อนเริ่มเกม</span>
          </h2>
          <p className="mx-auto max-w-md text-sm text-text-muted">
            ลองจัดทีมใน Draft Assistant แล้วดูว่าทีมคุณขาดอะไร
          </p>
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link
              to="/draft"
              className={cn("home-cta inline-flex min-h-11 items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-accent-fg", FOCUS)}
            >
              เริ่มวิเคราะห์ Draft <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/heroes"
              className={cn(
                "inline-flex min-h-11 items-center rounded-xl border border-border bg-bg/60 px-5 py-2.5 text-sm font-medium text-text hover:border-accent/50",
                FOCUS
              )}
            >
              ดูฮีโร่ทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      {/* 7. แมตช์ของฉัน (เฉพาะผู้ที่ล็อกอิน; อยู่ล่างสุด) */}
      <MyMatchesCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({
  metaLabel,
  heroCount,
  topTierCount,
  patch,
  rankLabel,
  mosaic,
}: {
  metaLabel: string;
  heroCount: number | null;
  topTierCount: number | null;
  patch: string | null;
  rankLabel: string;
  mosaic: HeroSummary[];
}) {
  // แยกวรรคแรกของสโลแกนเป็นสีขาว ที่เหลือเป็นไล่สีทอง
  const [first, ...rest] = SITE.taglineTh.split(" ");
  const restText = rest.join(" ");

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-bg-raised via-bg-surface to-bg px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
      {/* ฉากหลัง: ตาราง + แสงทอง/ฟ้า */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 -z-10 h-96 w-96 rounded-full bg-accent/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-96 w-96 rounded-full bg-rift/15 blur-3xl"
      />

      <div className="grid items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <p className="home-fade-up inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent">
            <span className="relative flex h-2 w-2">
              <span className="home-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {SITE.taglineEn}
          </p>

          <h1
            className="home-fade-up font-display text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            {first}
            {restText && (
              <>
                <br />
                <span className="home-gold-text">{restText}</span>
              </>
            )}
          </h1>

          <p
            className="home-fade-up max-w-xl text-base leading-relaxed text-text-muted"
            style={{ animationDelay: "160ms" }}
          >
            วิเคราะห์องค์ประกอบทีม หาเคาน์เตอร์ และเลือกฮีโร่ให้เข้ากับแผนการเล่น
          </p>

          <div
            className="home-fade-up flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              to="/draft"
              className={cn(
                "home-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-accent-fg",
                FOCUS
              )}
            >
              เริ่มวิเคราะห์ Draft <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/tier-list"
              className={cn(
                "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-text transition-colors hover:border-accent/50 hover:bg-white/10",
                FOCUS
              )}
            >
              ดู Tier List
            </Link>
          </div>

          {/* สถิติสั้นๆ ของระบบ */}
          <dl
            className="home-fade-up grid max-w-md grid-cols-3 gap-2 pt-2"
            style={{ animationDelay: "320ms" }}
            aria-label={metaLabel || "ภาพรวมข้อมูล"}
          >
            <HeroStat label="ฮีโร่ในระบบ" value={heroCount} />
            <HeroStat label="Tier S+ / S" value={topTierCount} />
            <HeroStat label={patch ? "Patch" : "ระดับแรงค์"} value={patch ?? rankLabel} text />
          </dl>
        </div>

        {/* โมเสกฮีโร่ลอยได้ (เฉพาะจอกว้าง) */}
        <div aria-hidden className="relative hidden md:block">
          <div className="absolute inset-6 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative grid grid-cols-3 gap-3 [transform:rotate(-6deg)]">
            {mosaic.length === 0
              ? Array.from({ length: MOSAIC_SIZE }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-2xl" />
                ))
              : mosaic.map((h, i) => (
                  <div
                    key={h.id}
                    className={cn(
                      "home-float aspect-square overflow-hidden rounded-2xl border border-white/10 bg-bg-raised shadow-card ring-1 ring-accent/20",
                      i % 3 === 1 && "translate-y-5",
                      i % 3 === 2 && "-translate-y-2"
                    )}
                    style={{ animationDelay: `${i * 380}ms` }}
                  >
                    <img
                      src={h.icon}
                      alt=""
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, text = false }: { label: string; value: number | string | null; text?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <dt className="mt-1.5 text-[11px] text-text-faint">{label}</dt>
      <dd className={cn("font-display font-semibold leading-none text-text", text ? "truncate text-sm" : "text-xl")}>
        {value ?? "–"}
      </dd>
    </div>
  );
}

// แถบไอคอนฮีโร่เลื่อนวนไม่หยุด (ชี้เมาส์เพื่อหยุด) — ตกแต่ง ซ่อนจาก screen reader; ลิงก์ซ้ำไม่รับโฟกัสคีย์บอร์ด
function HeroMarquee({ heroes }: { heroes: HeroSummary[] }) {
  if (heroes.length < 6) return null;
  const loop = [...heroes, ...heroes];
  return (
    <div
      aria-hidden
      className="home-marquee relative -mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]"
    >
      <div className="home-marquee-track flex gap-3 py-1">
        {loop.map((h, i) => (
          <Link
            key={`${h.id}-${i}`}
            to={`/heroes/${h.slug}`}
            tabIndex={-1}
            className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-bg-raised transition duration-300 hover:scale-110 hover:border-accent/60 sm:h-16 sm:w-16"
          >
            <img
              src={h.icon}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionHeading({
  id,
  index,
  title,
  sub,
  aside,
}: {
  id: string;
  index: string;
  title: string;
  sub?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-xs font-semibold tabular-nums tracking-widest text-accent">{index}</span>
          <span aria-hidden className="h-px w-8 bg-gradient-to-r from-accent to-transparent" />
        </div>
        <h2 id={id} className="mt-1 font-display text-xl font-semibold leading-tight sm:text-2xl">
          {title}
        </h2>
        {sub && <p className="mt-1 text-sm text-text-muted">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
      {children}
    </span>
  );
}

function MoreLink({
  to,
  icon: Icon,
  rgb,
  title,
  desc,
}: {
  to: string;
  icon: IconType;
  rgb: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      style={glow(rgb)}
      className={cn(
        "home-glow group flex min-h-11 items-center gap-3 rounded-card border border-border bg-bg-surface p-4",
        FOCUS
      )}
    >
      <span className="home-glow-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-text-muted">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-1 group-hover:text-accent" />
    </Link>
  );
}

// แถว Tier S+ และ S : ไอคอนฮีโร่ฟอร์มเดียวกับหน้า Tier List แต่ย่อส่วน (เรียง A–Z ไม่ใช่อันดับความแรง)
const TOP_TIER_GRID = "grid grid-cols-6 gap-2 sm:grid-cols-12";

function TopTierRows({
  loading,
  error,
  groups,
  curated,
}: {
  loading: boolean;
  error: boolean;
  groups: { tier: Tier; heroes: HeroSummary[] }[] | null;
  curated: boolean;
}) {
  if (error) return null; // ส่วนสถิติด้านล่างแสดงข้อความ error อยู่แล้ว
  const visible = groups ? groups.filter((g) => g.heroes.length > 0) : [];
  if (!loading && groups && visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h3 className="font-display text-sm font-medium text-text-muted">ฮีโร่ Tier สูงสุด</h3>
        <span className="text-[11px] text-text-faint">
          {curated ? "จัดโดยทีมงาน" : "คำนวณจาก Win Rate"} · เรียง A–Z
        </span>
      </div>

      {loading || !groups ? (
        <div className="space-y-3">
          {TOP_TIERS.map((t) => (
            <div key={t} className={cn(TOP_TIER_GRID, "rounded-2xl border border-border bg-bg-surface p-3")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        visible.map(({ tier, heroes }) => {
          const shown = heroes.slice(0, TOP_TIER_MAX);
          const extra = heroes.length - shown.length;
          const rgb = TIER_GLOW[tier] ?? GLOW.gold;
          return (
            <div
              key={tier}
              style={glow(rgb)}
              className="relative overflow-hidden rounded-2xl border border-[rgb(var(--glow)/0.3)] bg-bg-surface p-3 sm:p-4"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgb(var(--glow)/0.18),transparent_45%)]"
              />
              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <Badge tier={tier} className="px-3 py-1 text-sm shadow-[0_0_24px_-4px_rgb(var(--glow)/0.9)]">
                    {tier}
                  </Badge>
                  <span className="text-xs text-text-muted">{heroes.length} ฮีโร่</span>
                </div>
                <div className={TOP_TIER_GRID}>
                  {shown.map((h) => (
                    <Link
                      key={h.id}
                      to={`/heroes/${h.slug}`}
                      aria-label={h.nameTh}
                      title={h.nameTh}
                      className={cn(
                        "relative flex aspect-square w-full items-center justify-center rounded-lg bg-bg-raised font-display text-text-faint ring-1 ring-white/10 transition duration-200 hover:z-10 hover:scale-110 hover:ring-2 hover:ring-[rgb(var(--glow))]",
                        FOCUS
                      )}
                    >
                      {h.icon ? (
                        <img
                          src={h.icon}
                          alt={h.nameTh}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-full w-full rounded-lg object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <span className={`text-base font-display text-text-faint ${h.icon ? "hidden" : ""}`}>
                        {h.name.slice(0, 2).toUpperCase()}
                      </span>
                      <HeroBalanceBadge heroId={h.id} size="md" inside />
                    </Link>
                  ))}
                  {extra > 0 && (
                    <Link
                      to="/tier-list"
                      className={cn(
                        "flex aspect-square w-full flex-col items-center justify-center rounded-lg border border-border bg-bg/60 text-center transition hover:border-accent/50 hover:bg-bg-raised",
                        FOCUS
                      )}
                    >
                      <span className="font-display text-xs font-semibold text-text">+{extra}</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

type FetchState = { status: "loading" | "error" | "success"; refetch: () => void };

function StatSnapshot({
  title,
  icon: Icon,
  rgb,
  hint,
  state,
  heroes,
  metric,
  tone = "default",
}: {
  title: string;
  icon: IconType;
  rgb: string;
  hint?: string;
  state: FetchState;
  heroes: HeroSummary[];
  metric: "winRate" | "pickRate" | "banRate";
  tone?: StatTone;
}) {
  return (
    <div
      style={glow(rgb)}
      className="home-glass relative overflow-hidden rounded-2xl p-4"
    >
      {/* แถบสีบนสุดของการ์ด */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,rgb(var(--glow)),transparent)]"
      />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="home-glow-tile flex h-8 w-8 items-center justify-center rounded-lg">
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
        </div>
        {hint && (
          <span className="rounded-full bg-loss/15 px-2 py-0.5 text-[11px] font-medium text-loss ring-1 ring-loss/30">
            {hint}
          </span>
        )}
      </div>
      {state.status === "loading" && (
        <div className="grid gap-2">
          {Array.from({ length: SNAPSHOT_SIZE }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}
      {state.status === "error" && <ErrorState message="โหลดข้อมูลฮีโร่ไม่สำเร็จ" onRetry={state.refetch} />}
      {state.status === "success" && heroes.length === 0 && (
        <EmptyState icon={Swords} title="ยังไม่มีข้อมูลสถิติ" description="ข้อมูลจะแสดงเมื่อมีสถิติฮีโร่ในระบบ" />
      )}
      {state.status === "success" && heroes.length > 0 && (
        <div className="grid gap-2">
          {heroes.map((h, i) => (
            <StatBarRow key={h.id} hero={h} metric={h.stat[metric]} tone={tone} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
