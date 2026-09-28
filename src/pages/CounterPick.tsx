import { useMemo, useState } from "react";
import { GitCompareArrows, Search } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { CounterList } from "@/features/heroes/CounterList";
import { MOCK_HERO_DETAILS } from "@/data/heroes.mock";
import { cn } from "@/lib/utils";

export function CounterPick() {
  const heroes = useAsync(() => getHeroes(), []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (heroes.status !== "success") return [];
    if (query.trim() === "") return heroes.data;
    return heroes.data.filter((h) => h.nameTh.includes(query) || h.name.toLowerCase().includes(query.toLowerCase()));
  }, [heroes, query]);

  const selectedDetail = selected ? MOCK_HERO_DETAILS[selected] : null;
  const selectedHero = selected ? heroes.status === "success" ? heroes.data.find((h) => h.slug === selected) : undefined : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Counter Pick</h1>
        <p className="mt-1 text-sm text-text-muted">เลือกฮีโร่ฝั่งศัตรู ระบบจะบอกว่าใครสวนได้ และทำไม</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาฮีโร่ศัตรู..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
        />
      </div>

      {heroes.status === "loading" && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      )}
      {heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}

      {heroes.status === "success" && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelected(h.slug)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                selected === h.slug ? "border-accent bg-accent/10" : "border-border bg-bg-surface hover:border-accent/40"
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-raised font-display text-xs text-text-faint">
                {h.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate text-[11px] leading-tight">{h.nameTh}</span>
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
          {selectedDetail && selectedDetail.counteredBy.length > 0 ? (
            <CounterList entries={selectedDetail.counteredBy} emptyText="" />
          ) : (
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
