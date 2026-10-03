import { useMemo, useState } from "react";
import { Search, Swords } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { useAsync } from "@/hooks/useAsync";
import { HeroCard } from "@/features/heroes/HeroCard";
import { RoleFilterRow, LaneFilterRow } from "@/features/heroes/HeroFilters";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import type { HeroLane, HeroRole } from "@/types/hero";

export function Heroes() {
  const heroes = useAsync(() => getHeroes(), []);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<HeroRole | null>(null);
  const [lane, setLane] = useState<HeroLane | null>(null);

  const filtered = useMemo(() => {
    if (heroes.status !== "success") return [];
    return heroes.data.filter((h) => {
      const matchesQuery = query.trim() === "" || h.nameTh.includes(query) || h.name.toLowerCase().includes(query.toLowerCase());
      // ฮีโร่ที่ไปได้หลายตำแหน่ง/เลนต้องขึ้นในทุกตัวกรองที่ตรง (ใช้ roles/lanes ทั้งอาร์เรย์ ไม่ใช่แค่ค่าหลัก)
      const matchesRole = role === null || heroRoles(h).includes(role);
      const matchesLane = lane === null || heroLanes(h).includes(lane);
      return matchesQuery && matchesRole && matchesLane;
    });
  }, [heroes, query, role, lane]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">ฮีโร่ทั้งหมด</h1>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5 md:max-w-md">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่อฮีโร่ (ไทย/อังกฤษ)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
        />
      </div>

      <div className="space-y-2">
        <RoleFilterRow value={role} onChange={setRole} />
        <LaneFilterRow value={lane} onChange={setLane} />
      </div>

      {heroes.status === "loading" && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      )}
      {heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}
      {heroes.status === "success" && filtered.length === 0 && (
        <EmptyState icon={Swords} title="ไม่พบฮีโร่ที่ตรงเงื่อนไข" description="ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น" />
      )}
      {heroes.status === "success" && filtered.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 xl:grid-cols-8">
          {filtered.map((h) => (
            <HeroCard key={h.id} hero={h} compact />
          ))}
        </div>
      )}
    </div>
  );
}
