import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Hammer, LogIn, Plus } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getBuildForHero, getItems } from "@/services/items";
import { listCommunityBuilds, listMyBuilds, type UserBuild } from "@/services/userBuilds";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { Thumb } from "@/features/admin/ImageSelect";
import { ReadOnlyBuild, type ViewBuild } from "@/features/build/buildView";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/types/hero";

type Tab = "recommended" | "community" | "mine";
const TABS: [Tab, string][] = [
  ["recommended", "บิลด์แนะนำ"],
  ["community", "Community Build"],
  ["mine", "Build ของฉัน"],
];

// การ์ดเลือกฮีโร่แบบเดียวกับหน้า Matchup (ตัวกรอง Role/Lane + ป้าย balance)
function HeroPicker({ heroes, value, onChange }: { heroes: HeroSummary[]; value: HeroSummary | null; onChange: (h: HeroSummary) => void }) {
  const filters = useHeroFilters("build");
  const list = heroes.filter((h) => filters.match(h));
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-text-faint">
        เลือกฮีโร่
        {value && <span className="ml-2 text-accent">เลือกอยู่: {value.nameTh}</span>}
      </p>
      <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
      {list.length === 0 ? (
        <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
          {list.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onChange(h)}
              className={cn(
                "flex flex-col items-center gap-1 overflow-hidden rounded-lg border p-0 pb-1 text-center",
                value?.slug === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
              )}
            >
              <div className="relative flex aspect-square w-full items-center justify-center bg-bg-raised text-xs font-display text-text-faint">
                {h.icon ? (
                  <img
                    src={h.icon}
                    alt={h.nameTh}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span className={`text-sm font-display text-text-faint sm:text-base ${h.icon ? "hidden" : ""}`}>{h.name.slice(0, 2).toUpperCase()}</span>
                <HeroBalanceBadge heroId={h.id} size="md" inside />
              </div>
              <span className="w-full truncate px-1 text-[11px] leading-tight sm:text-xs">{h.nameTh}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Recommended({ hero }: { hero: HeroSummary }) {
  const q = useAsync(async () => {
    const [build, items] = await Promise.all([getBuildForHero(hero), getItems()]);
    const bySlug = new Map(items.map((i) => [i.slug, i]));
    const view: ViewBuild = {
      items: build.items.flatMap((i) => {
        const it = bySlug.get(i.itemSlug);
        return it ? [{ slug: it.slug, name: it.name, icon: it.icon || undefined, phase: i.phase, reason: i.reason }] : [];
      }),
      runes: build.arcana.map((a) => ({ key: a.name, name: a.name, icon: a.icon, color: a.color, quantity: a.quantity ?? 1 })),
      spell: build.spell
        ? { slug: build.spell.slug, name: build.spell.name, nameTh: build.spell.nameTh, icon: build.spell.icon, cooldownSeconds: build.spell.cooldownSeconds }
        : null,
      enchantments: (build.enchantments ?? []).map((e) => ({ slug: e.slug, name: e.name, nameTh: e.nameTh, icon: e.icon, tier: e.tier, type: e.type })),
    };
    return { patch: build.patch, source: build.source, view };
  }, [hero.id]);

  if (q.status === "loading") return <Skeleton className="h-48" />;
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  const { patch, source, view } = q.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Hammer className="h-4 w-4 text-accent" />
        <h2 className="font-display text-base font-semibold">บิลด์แนะนำ: {hero.nameTh}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">Patch {patch}</span>
      </div>
      {source === "heuristic" && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          * ยังไม่มีบิลด์เฉพาะฮีโร่นี้ นี่คือแนวทางทั่วไปตาม Role (Heuristic) ไม่ใช่บิลด์ที่ทีมงานเขียนเอง
        </p>
      )}
      <ReadOnlyBuild build={view} />
    </div>
  );
}

const dateTh = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "");

function BuildCard({ b, showHero }: { b: UserBuild; showHero: boolean }) {
  return (
    <Link to={`/build/view/${b.id}`} className="block space-y-2 rounded-card border border-border bg-bg-surface p-3 transition hover:border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showHero && <Thumb src={b.hero.icon} label={b.hero.nameTh} className="h-9 w-9" />}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-medium">{b.name}</p>
            <p className="truncate text-xs text-text-faint">
              {showHero ? `${b.hero.nameTh} · ` : ""}
              {b.author ? `โดย ${b.author.displayName ?? `@${b.author.handle}`} · ` : ""}
              {dateTh(b.isPublic ? b.publishedAt : b.updatedAt)}
            </p>
          </div>
        </div>
        {showHero && (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${b.hidden ? "border-loss/40 text-loss" : b.isPublic ? "border-win/40 text-win" : "border-border text-text-faint"}`}>
            {b.hidden ? "ถูกซ่อน" : b.isPublic ? "เผยแพร่แล้ว" : "ส่วนตัว"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {b.view.items.slice(0, 6).map((i) => <Thumb key={i.slug} src={i.icon} label={i.name} className="h-8 w-8" />)}
        {b.view.spell && <Thumb src={b.view.spell.icon} label={b.view.spell.nameTh} round className="ml-1 h-8 w-8" />}
      </div>
    </Link>
  );
}

function CreateButton({ hero }: { hero: HeroSummary | null }) {
  const cls = "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium";
  if (!hero) return <span className={`${cls} cursor-not-allowed border border-border text-text-faint`}>เลือกฮีโร่ก่อนสร้างบิลด์</span>;
  return (
    <Link to={`/build/edit/new?hero=${hero.slug}`} className={`${cls} bg-accent text-accent-fg hover:brightness-110`}>
      <Plus className="h-4 w-4" />สร้างบิลด์ {hero.nameTh}
    </Link>
  );
}

function Community({ hero }: { hero: HeroSummary }) {
  const q = useAsync(() => listCommunityBuilds(hero.id), [hero.id]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Community Build: {hero.nameTh}</h2>
        <CreateButton hero={hero} />
      </div>
      {q.status === "loading" && <Skeleton className="h-32" />}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}
      {q.status === "success" && q.data.length === 0 && (
        <EmptyState icon={Hammer} title="ยังไม่มี Community Build" description="สร้างบิลด์ของคุณแล้วเผยแพร่เป็นคนแรกของฮีโร่ตัวนี้" />
      )}
      {q.status === "success" && q.data.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">{q.data.map((b) => <BuildCard key={b.id} b={b} showHero={false} />)}</div>
      )}
    </div>
  );
}

function Mine({ hero }: { hero: HeroSummary | null }) {
  const { user, loading } = useAuth();
  const q = useAsync(() => (user ? listMyBuilds(user.id) : Promise.resolve([] as UserBuild[])), [user?.id]);
  if (loading) return <Skeleton className="h-32" />;
  if (!user) {
    return (
      <div className="space-y-3">
        <EmptyState icon={LogIn} title="ต้องล็อกอินก่อน" description="เข้าสู่ระบบเพื่อสร้างและเก็บบิลด์ของคุณ" />
        <Link to="/login" className="block text-center text-sm text-accent">ไปหน้าล็อกอิน →</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Build ของฉัน</h2>
        <CreateButton hero={hero} />
      </div>
      {q.status === "loading" && <Skeleton className="h-32" />}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}
      {q.status === "success" && q.data.length === 0 && (
        <EmptyState icon={Hammer} title="ยังไม่มีบิลด์" description="เลือกฮีโร่ด้านบน แล้วกดสร้างบิลด์" />
      )}
      {q.status === "success" && q.data.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">{q.data.map((b) => <BuildCard key={b.id} b={b} showHero />)}</div>
      )}
    </div>
  );
}

export function ItemBuild() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const [params, setParams] = useSearchParams();
  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const slug = params.get("hero") ?? "";
  const selected = useMemo(() => heroes.find((h) => h.slug === slug) ?? null, [heroes, slug]);
  const tab: Tab = TABS.some(([t]) => t === params.get("tab")) ? (params.get("tab") as Tab) : "recommended";

  const update = (k: string, v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set(k, v);
        return n;
      },
      { replace: true }
    );

  useDocumentMeta({
    title: selected ? `บิลด์ ${selected.nameTh} — ไอเทม รูน สกิลชาเลนเจอร์ พลังแฝง RoV | RoV LAB` : "Item Build RoV — บิลด์แนะนำและ Community Build | RoV LAB",
    description: "บิลด์แนะนำรายฮีโร่ใน RoV พร้อมสร้างบิลด์ของตัวเองและแบ่งปัน Community Build",
    path: "/build",
    breadcrumbs: [{ name: "หน้าแรก", path: "/" }, { name: "Item Build", path: "/build" }],
  });

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Item Build</h1>
        <p className="mt-1 text-sm text-text-muted">บิลด์แนะนำ ไอเทม รูน สกิลชาเลนเจอร์ พลังแฝง สร้างเอง และแบ่งปันให้คนอื่น</p>
      </div>

      <div role="tablist" aria-label="หมวดบิลด์" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => update("tab", t)}
            className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition ${tab === t ? "border-accent bg-accent font-medium text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {heroesQ.status === "loading" && <Skeleton className="h-48" />}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && <HeroPicker heroes={heroes} value={selected} onChange={(h) => update("hero", h.slug)} />}

      {heroesQ.status === "success" && (
        <div className="border-t border-border pt-4">
          {tab === "mine" && <Mine hero={selected} />}
          {tab !== "mine" && !selected && <EmptyState icon={Hammer} title="ยังไม่ได้เลือกฮีโร่" description="เลือกฮีโร่ด้านบนเพื่อดูบิลด์" />}
          {tab === "recommended" && selected && <Recommended hero={selected} />}
          {tab === "community" && selected && <Community hero={selected} />}
        </div>
      )}
    </div>
  );
}
