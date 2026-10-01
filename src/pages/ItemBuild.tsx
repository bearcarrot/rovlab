import { useState } from "react";
import { Search, Hammer } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getArcana, findArcana, getBuildForHero } from "@/services/items";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AskCoach } from "@/components/AskCoach";
import { HeroIcon } from "@/components/HeroIcon";
import { BuildItemRow } from "@/features/build/BuildItemRow";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import type { HeroSummary } from "@/types/hero";
import type { ArcanaColor } from "@/types/item";

const PHASE_LABEL = { early: "ช่วงต้นเกม", core: "ไอเทมหลัก", situational: "ตามสถานการณ์" } as const;

// สีของรูน (ใช้ inline style เพื่อไม่ผูกกับ palette ของ Tailwind)
const ARCANA_COLOR: Record<ArcanaColor, { hex: string; label: string }> = {
  red: { hex: "#ef4444", label: "แดง" },
  purple: { hex: "#a855f7", label: "ม่วง" },
  green: { hex: "#22c55e", label: "เขียว" },
};

export function ItemBuild() {
  const heroesQ = useAsync(() => getHeroes(), []);
  const arcanaQ = useAsync(() => getArcana(), []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HeroSummary | null>(null);
  const filters = useHeroFilters();
  const buildQ = useAsync(() => (selected ? getBuildForHero(selected) : Promise.resolve(null)), [selected?.slug]);

  const heroes = heroesQ.status === "success" ? heroesQ.data : [];
  const filtered = heroes.filter(
    (h) => filters.match(h) && (query.trim() === "" || h.nameTh.includes(query) || h.name.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Item Build</h1>
        <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่เพื่อดูบิลด์แนะนำพร้อมเหตุผล</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาฮีโร่..." className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint" />
      </div>

      <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />

      {heroesQ.status === "loading" && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      )}
      {heroesQ.status === "error" && <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />}
      {heroesQ.status === "success" && filtered.length === 0 && (
        <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
      )}
      {heroesQ.status === "success" && filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelected(h)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center ${selected?.slug === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-raised font-display text-xs text-text-faint">
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

  <span className={`text-2xl font-display text-text-faint ${h.icon ? "hidden" : ""}`}>
    {h.name.slice(0, 2).toUpperCase()}
  </span>
              </div>
              <span className="truncate text-[11px] leading-tight">{h.nameTh}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold">บิลด์แนะนำ: {selected.nameTh}</h2>
          </div>

          {buildQ.status === "loading" && <Skeleton className="h-40" />}
          {buildQ.status === "error" && <ErrorState message={buildQ.message} />}
          {buildQ.status === "success" && buildQ.data && (
            <>
              {buildQ.data.source === "heuristic" && (
                <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
                  * บิลด์นี้สร้างจากกฎเกณฑ์ตาม Role (Heuristic) ยังไม่ใช่บิลด์ที่เขียนเฉพาะฮีโร่นี้
                </p>
              )}
              {(["early", "core", "situational"] as const).map((phase) => {
                const items = buildQ.data!.items.filter((i) => i.phase === phase);
                if (items.length === 0) return null;
                return (
                  <div key={phase}>
                    <p className="mb-2 text-xs font-medium text-text-faint">{PHASE_LABEL[phase]}</p>
                    <div className="space-y-2">
                      {items.map((i) => <BuildItemRow key={i.itemSlug} entry={i} />)}
                    </div>
                  </div>
                );
              })}
              {buildQ.data.arcana.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Arcana แนะนำ</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {buildQ.data.arcana.map((a) => {
                      // Icon + stat line come from the real `arcana` table; a miss falls back to initials.
                      const meta = arcanaQ.status === "success" ? findArcana(arcanaQ.data, a.name) : undefined;
                      const c = a.color ? ARCANA_COLOR[a.color] : undefined;
                      const desc = a.description ?? meta?.description;
                      return (
                        <div
                          key={a.name}
                          className="flex gap-3 rounded-lg border border-border bg-bg-raised p-3"
                          style={{ borderColor: c ? `${c.hex}66` : undefined, borderLeftWidth: c ? 4 : undefined, borderLeftColor: c?.hex }}
                        >
                          <HeroIcon icon={a.icon ?? meta?.icon} name={a.name} className="bg-bg" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-display text-sm font-medium">{a.name}</p>
                              {a.quantity ? (
                                <span
                                  className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-white"
                                  style={{ backgroundColor: c?.hex ?? "#64748b" }}
                                >
                                  x{a.quantity}
                                </span>
                              ) : null}
                              {c && <span className="ml-auto text-[11px]" style={{ color: c.hex }}>{c.label}</span>}
                            </div>
                            {desc && <p className="text-xs text-text-faint">{desc}</p>}
                            {a.reason && <p className="mt-1 text-sm text-text-muted">{a.reason}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
              <AskCoach
                resetKey={selected.slug}
                label="ถามโค้ช AI: เลือกไอเทมยังไง"
                prompt={`อธิบายว่าทำไมบิลด์นี้เหมาะกับ ${selected.nameTh} และควรสลับไอเทมตามสถานการณ์อย่างไร ไม่เกิน 4 ประโยค`}
                context={{ hero: selected.nameTh, source: buildQ.data.source, items: buildQ.data.items, arcana: buildQ.data.arcana }}
              />
            </>
          )}
        </div>
      )}

      {!selected && heroesQ.status === "success" && (
        <EmptyState icon={Hammer} title="ยังไม่ได้เลือกฮีโร่" description="เลือกฮีโร่ด้านบนเพื่อดูบิลด์แนะนำ" />
      )}
    </div>
  );
}
