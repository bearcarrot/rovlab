import { useMemo, useState } from "react";
import { GitCompareArrows, Search } from "lucide-react";
import { getHeroBySlug, getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { AskCoach } from "@/components/AskCoach";
import { CounterList } from "@/features/heroes/CounterList";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { cn } from "@/lib/utils";

export function CounterPick() {
  const heroes = useAsync(() => getHeroes(), []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const filters = useHeroFilters();

  // ข้อมูลตัวสวนจริงจาก Supabase (hero_counters) ผ่าน getHeroBySlug — ไม่ใช้ mock แล้ว
  const detailQ = useAsync(() => (selected ? getHeroBySlug(selected) : Promise.resolve(null)), [selected]);

  const filtered = useMemo(() => {
    if (heroes.status !== "success") return [];
    const q = query.trim();
    return heroes.data.filter(
      (h) => filters.match(h) && (q === "" || h.nameTh.includes(q) || h.name.toLowerCase().includes(q.toLowerCase()))
    );
  }, [heroes, query, filters.match]);

  // slug → icon URL จากรายชื่อฮีโร่ที่โหลดแล้ว ใช้เป็น fallback แสดงไอคอนในรายการตัวสวน
  const iconBySlug = useMemo<Record<string, string>>(() => {
    if (heroes.status !== "success") return {};
    return Object.fromEntries(heroes.data.map((h) => [h.slug, h.icon]));
  }, [heroes]);

  const selectedHero = selected ? heroes.status === "success" ? heroes.data.find((h) => h.slug === selected) : undefined : undefined;
  const counters = detailQ.status === "success" && detailQ.data ? detailQ.data.counteredBy : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Counter Pick</h1>
        <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่ฝั่งศัตรู ระบบจะบอกว่าใครสวนได้ และทำไม</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5 md:max-w-md">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาฮีโร่ศัตรู..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
        />
      </div>

      <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />

      {heroes.status === "loading" && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7 xl:grid-cols-9">
          {Array.from({ length: 16 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      )}
      {heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}

      {heroes.status === "success" && filtered.length === 0 && (
        <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
      )}
      {heroes.status === "success" && filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7 xl:grid-cols-9">
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelected(h.slug)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                selected === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
              )}
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-bg-raised font-display text-xs text-text-faint sm:h-11 sm:w-11">
                {h.icon ? (
                  <img
                    src={h.icon}
                    alt={h.nameTh}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full rounded-md object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}

                <span className={`text-sm font-display text-text-faint sm:text-base ${h.icon ? "hidden" : ""}`}>
                  {h.name.slice(0, 2).toUpperCase()}
                </span>
                <HeroBalanceBadge heroId={h.id} />
              </div>
              <span className="w-full truncate text-[11px] leading-tight sm:text-xs">{h.nameTh}</span>
            </button>
          ))}
        </div>
      )}

      {selected && selectedHero && (
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold">ตัวสวน {selectedHero.nameTh}</h2>
          </div>

          {detailQ.status === "loading" && <Skeleton className="h-40" />}
          {detailQ.status === "error" && <ErrorState message={detailQ.message} onRetry={detailQ.refetch} />}
          {detailQ.status === "success" && counters.length > 0 && (
            <>
              <CounterList entries={counters} emptyText="" icons={iconBySlug} grid />
              <AskCoach
                resetKey={selected}
                label="ถามโค้ช AI: เจอตัวนี้ต้องเล่นยังไง"
                prompt={`ผู้เล่นต้องเจอ ${selectedHero.nameTh} ฝั่งศัตรู แนะนำวิธีเล่นสวนและจังหวะที่ต้องระวัง ไม่เกิน 4 ประโยค`}
                context={{ enemy: selectedHero.nameTh, counteredBy: counters }}
              />
            </>
          )}
          {detailQ.status === "success" && counters.length === 0 && (
            <EmptyState
              icon={GitCompareArrows}
              title="ยังไม่มีข้อมูลตัวสวนสำหรับฮีโร่นี้"
              description="ทีมงานกำลังเพิ่มข้อมูลเชิงลึกสำหรับฮีโร่ทุกตัว"
            />
          )}
        </div>
      )}
    </div>
  );
}
