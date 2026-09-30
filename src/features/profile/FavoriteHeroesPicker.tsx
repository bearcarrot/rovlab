import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { HeroIcon } from "@/components/HeroIcon";
import { HeroFilterBar, useHeroFilters } from "@/features/heroes/HeroFilterBar";
import type { HeroSummary } from "@/types/hero";

type Props = {
  value: string[]; // hero ids
  onChange: (ids: string[]) => void;
  heroes: HeroSummary[];
  max?: number;
};

export function FavoriteHeroesPicker({ value, onChange, heroes, max = 3 }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filters = useHeroFilters();

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  // ids that no longer match a hero are dropped here, and therefore on the next change/save
  const selected = value.map((id) => byId.get(id)).filter((h): h is HeroSummary => !!h);
  const selectedIds = selected.map((h) => h.id);

  const q = query.trim();
  const pool = heroes.filter(
    (h) =>
      !selectedIds.includes(h.id) &&
      filters.match(h) &&
      (q === "" || h.nameTh.includes(q) || h.name.toLowerCase().includes(q.toLowerCase()))
  );

  function add(hero: HeroSummary) {
    if (selectedIds.length >= max) return;
    const next = [...selectedIds, hero.id];
    onChange(next);
    if (next.length >= max) setOpen(false);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: max }).map((_, i) => {
          const h = selected[i];
          if (h) {
            return (
              <div key={h.id} className="relative flex flex-col items-center gap-1 rounded-lg border border-border bg-bg-raised p-2">
                <HeroIcon icon={h.icon} name={h.name} className="h-14 w-14" />
                <span className="w-full truncate text-center text-[11px]">{h.nameTh}</span>
                <button
                  type="button"
                  onClick={() => remove(h.id)}
                  aria-label={`เอา ${h.nameTh} ออก`}
                  className="absolute right-1 top-1 rounded-full bg-bg-surface p-0.5 text-text-faint hover:text-loss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => setOpen(true)}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-2 text-text-faint hover:border-accent/50 hover:text-accent"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[11px]">เลือกฮีโร่</span>
            </button>
          );
        })}
      </div>

      {open && selectedIds.length < max && (
        <div className="space-y-2 rounded-card border border-border bg-bg p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาฮีโร่..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
            />
          </div>
          <HeroFilterBar role={filters.role} lane={filters.lane} onRole={filters.setRole} onLane={filters.setLane} />
          {pool.length === 0 ? (
            <p className="text-sm text-text-faint">ไม่พบฮีโร่ที่ตรงกับตัวกรอง</p>
          ) : (
            <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-7">
              {pool.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => add(h)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg-surface p-1.5 text-center hover:border-accent/40"
                >
                  <HeroIcon icon={h.icon} name={h.name} className="h-9 w-9" />
                  <span className="w-full truncate text-[10px] leading-tight">{h.nameTh}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-faint hover:text-text">
            ปิด
          </button>
        </div>
      )}
    </div>
  );
}
