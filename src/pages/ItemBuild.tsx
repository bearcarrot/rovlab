import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Hammer, Search } from "lucide-react";
import { useState } from "react";
import { getHeroes } from "@/services/heroes";
import { getBuildForHero } from "@/services/items";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { HeroIcon } from "@/components/HeroIcon";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuildItemRow } from "@/features/build/BuildItemRow";
import type { BuildEnchantment, HeroBuild } from "@/types/item";
import type { HeroSummary } from "@/types/hero";

const PHASE_LABEL = { early: "ช่วงต้นเกม", core: "ไอเทมหลัก", situational: "ตามสถานการณ์" } as const;
const RUNE_COLOR: Record<string, string> = { red: "bg-loss", purple: "bg-purple-400", green: "bg-win" };

function EnchantmentRow({ e }: { e: BuildEnchantment }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
      <HeroIcon icon={e.icon} name={e.name} className="h-10 w-10 shrink-0 bg-bg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-display text-sm font-medium">{e.nameTh}</p>
          {e.tier ? <span className="shrink-0 text-xs text-text-faint">Tier {e.tier}</span> : null}
        </div>
        <p className="text-xs text-text-faint">{e.name}</p>
        {e.description && <p className="mt-1 whitespace-pre-line text-sm text-text-muted">{e.description}</p>}
      </div>
    </div>
  );
}

function BuildView({ hero, build }: { hero: HeroSummary; build: HeroBuild }) {
  const primary = (build.enchantments ?? []).filter((e) => e.type === "primary");
  const secondary = (build.enchantments ?? []).filter((e) => e.type === "secondary");
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Hammer className="h-4 w-4 text-accent" />
        <h2 className="font-display text-base font-semibold">บิลด์แนะนำ: {hero.nameTh}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">Patch {build.patch}</span>
      </div>

      {build.source === "heuristic" && (
        <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          * ยังไม่มีบิลด์เฉพาะฮีโร่นี้ นี่คือแนวทางทั่วไปตาม Role (Heuristic) ไม่ใช่บิลด์ที่ทีมงานเขียนเอง
        </p>
      )}

      {(["early", "core", "situational"] as const).map((phase) => {
        const items = build.items.filter((i) => i.phase === phase);
        if (items.length === 0) return null;
        return (
          <div key={phase}>
            <p className="mb-2 text-xs font-medium text-text-faint">{PHASE_LABEL[phase]}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((i) => <BuildItemRow key={i.itemSlug} entry={i} />)}
            </div>
          </div>
        );
      })}

      <Card>
        <CardHeader><CardTitle>รูนแนะนำ</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {build.arcana.length === 0 && <p className="text-sm text-text-faint">ยังไม่มีข้อมูลรูน</p>}
          {build.arcana.map((a) => (
            <div key={a.name + (a.quantity ?? "")} className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
              <HeroIcon icon={a.icon} name={a.name} className="h-10 w-10 shrink-0 bg-bg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-display text-sm font-medium">
                  {a.color && <span className={`h-2 w-2 rounded-full ${RUNE_COLOR[a.color] ?? "bg-text-faint"}`} />}
                  {a.name}{a.quantity ? ` ×${a.quantity}` : ""}
                </p>
                {a.reason && <p className="mt-1 text-sm text-text-muted">{a.reason}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {build.source === "curated" && (
        <Card>
          <CardHeader><CardTitle>สกิลชาเลนเจอร์</CardTitle></CardHeader>
          <CardContent>
            {build.spell ? (
              <div className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3">
                <HeroIcon icon={build.spell.icon} name={build.spell.name} className="h-11 w-11 shrink-0 bg-bg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display text-sm font-medium">{build.spell.nameTh} <span className="text-text-faint">({build.spell.name})</span></p>
                    {build.spell.cooldownSeconds != null && <span className="shrink-0 text-xs text-text-faint">CD {build.spell.cooldownSeconds}s</span>}
                  </div>
                  {build.spell.status === "seasonal" && <p className="text-[11px] text-accent">ตามซีซัน</p>}
                  {build.spell.description && <p className="mt-1 text-sm text-text-muted">{build.spell.description}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-faint">ยังไม่มีข้อมูลสกิลชาเลนเจอร์สำหรับบิลด์นี้</p>
            )}
          </CardContent>
        </Card>
      )}

      {build.source === "curated" && (
        <Card>
          <CardHeader><CardTitle>พลังแฝง</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {primary.length + secondary.length === 0 && <p className="text-sm text-text-faint">ยังไม่มีข้อมูลพลังแฝงสำหรับบิลด์นี้</p>}
            {primary.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-text-faint">หลัก</p>
                <div className="grid gap-2 md:grid-cols-2">{primary.map((e) => <EnchantmentRow key={e.slug} e={e} />)}</div>
              </div>
            )}
            {secondary.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-text-faint">รอง</p>
                <div className="grid gap-2 md:grid-cols-2">{secondary.map((e) => <EnchantmentRow key={e.slug} e={e} />)}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ItemBuild() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const slug = params.get("hero") ?? "";

  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const selected = useMemo(() => heroes.find((h) => h.slug === slug) ?? null, [heroes, slug]);
  const buildQ = useAsync(() => (selected ? getBuildForHero(selected) : Promise.resolve(null)), [selected?.id]);
  const q = query.trim().toLowerCase();
  const filtered = heroes.filter((h) => q === "" || h.nameTh.toLowerCase().includes(q) || h.name.toLowerCase().includes(q));

  useDocumentMeta({
    title: selected ? `บิลด์ ${selected.nameTh} — ไอเทม รูน สกิลชาเลนเจอร์ พลังแฝง RoV | RoV LAB` : "Item Build RoV — บิลด์แนะนำรายฮีโร่ | RoV LAB",
    description: "บิลด์แนะนำรายฮีโร่ใน RoV: ไอเทม รูน สกิลชาเลนเจอร์ และพลังแฝง พร้อมเหตุผล",
    path: "/build",
    breadcrumbs: [{ name: "หน้าแรก", path: "/" }, { name: "Item Build", path: "/build" }],
  });

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Item Build</h1>
        <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่เพื่อดูบิลด์แนะนำ ไอเทม รูน สกิลชาเลนเจอร์ และพลังแฝง พร้อมเหตุผล</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาฮีโร่..."
          className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm"
        />
      </div>

      {heroesQ.status === "loading" && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      )}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
          {filtered.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setParams({ hero: h.slug }, { replace: true })}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center ${selected?.slug === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"}`}
            >
              <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.name.slice(0, 2).toUpperCase()} className="h-9 w-9" />
              <span className="w-full truncate text-[11px] leading-tight">{h.nameTh}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="col-span-full py-6 text-center text-sm text-text-muted">ไม่พบฮีโร่ที่ค้นหา</p>}
        </div>
      )}

      {selected && buildQ.status === "loading" && <Skeleton className="h-48" />}
      {selected && buildQ.status === "error" && <ErrorState message={buildQ.message} onRetry={buildQ.refetch} />}
      {selected && buildQ.status === "success" && buildQ.data && <BuildView hero={selected} build={buildQ.data} />}
      {!selected && heroesQ.status === "success" && (
        <EmptyState icon={Hammer} title="ยังไม่ได้เลือกฮีโร่" description="เลือกฮีโร่ด้านบนเพื่อดูบิลด์แนะนำ" />
      )}
    </div>
  );
}
