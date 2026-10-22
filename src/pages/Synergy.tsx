import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Handshake, Plus, Search } from "lucide-react";
import { getAllSynergies, type SynergyHero } from "@/services/synergies";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { HeroIcon } from "@/components/HeroIcon";
import { heroMatchesQuery } from "@/lib/heroSearch";

// ไอคอน + ชื่อ กดไปหน้ารายละเอียดฮีโร่ได้ (ทุกไอคอนฮีโร่ในเว็บต้องกดได้)
function HeroLink({ h }: { h: SynergyHero }) {
  return (
    <Link to={`/heroes/${h.slug}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
      <HeroIcon icon={h.icon} name={h.nameTh} fallback={h.slug.slice(0, 2).toUpperCase()} className="h-11 w-11" />
      <span className="truncate font-display text-sm font-medium">{h.nameTh}</span>
    </Link>
  );
}

export function Synergy() {
  const pairs = useAsync(() => getAllSynergies(), []);
  const [query, setQuery] = useState("");

  // ค้นได้ทั้งฮีโร่ตัวหลักและคู่คอมโบ: พิมพ์ชื่อตัวไหนก็เจอทุกคู่ที่เกี่ยวข้อง
  const shown = useMemo(() => {
    if (pairs.status !== "success") return [];
    return pairs.data.filter((p) => heroMatchesQuery(p.hero, query) || heroMatchesQuery(p.partner, query));
  }, [pairs, query]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold">Combo / Synergy</h1>
        <p className="mt-1 text-sm text-text-muted">ฮีโร่ที่เล่นคู่กันแล้วเสริมกัน พร้อมเหตุผลว่าคอมโบนี้ทำงานยังไง</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5 md:max-w-md">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาฮีโร่..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
        />
      </div>

      {pairs.status === "loading" && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      )}
      {pairs.status === "error" && <ErrorState message={pairs.message} onRetry={pairs.refetch} />}

      {pairs.status === "success" && pairs.data.length === 0 && (
        <EmptyState icon={Handshake} title="ยังไม่มีข้อมูลคอมโบ" description="ทีมงานกำลังเพิ่มข้อมูลคอมโบระหว่างฮีโร่" />
      )}
      {pairs.status === "success" && pairs.data.length > 0 && shown.length === 0 && (
        <p className="text-sm text-text-faint">ไม่พบคอมโบของฮีโร่ที่ค้นหา</p>
      )}

      {shown.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <div key={p.id} className="rounded-card border border-border bg-bg-surface p-3">
              <div className="flex items-center gap-2">
                <HeroLink h={p.hero} />
                <Plus className="h-4 w-4 shrink-0 text-accent" aria-label="คู่กับ" />
                <HeroLink h={p.partner} />
              </div>
              <p className="mt-2 text-sm text-text-muted">{p.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
