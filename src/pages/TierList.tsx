import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import { getCuratedTiers } from "@/services/tierlist";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { RoleFilterRow, LaneFilterRow } from "@/features/heroes/HeroFilters";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { HeroBalanceBadge } from "@/features/balance/HeroBalanceBadge";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Badge } from "@/components/ui/badge";
import { RANK_LABEL, useRank } from "@/lib/rank";
import type { HeroLane, HeroRole, Tier } from "@/types/hero";

const TIER_ORDER: Tier[] = ["S+", "S", "A", "B", "C"];

export function TierList() {
  const heroes = useAsync(() => getHeroes(), []);
  const rank = useRank();
  // จำค่าตัวกรองไว้แม้สลับแรงก์ (หน้าถูก remount เมื่อ rank เปลี่ยน) — ช่วงแรงก์สลับที่ปุ่มบน Header
  const [role, setRole] = usePersistedState<HeroRole | null>("rovlab:filter:tier:role", null);
  const [lane, setLane] = usePersistedState<HeroLane | null>("rovlab:filter:tier:lane", null);
  // Tier ที่แอดมินจัดเองตามแพตช์/แรงก์/เลนที่เลือก (null = ยังไม่มีลิสต์ → ใช้ tier จาก hero_stats แทน)
  const curated = useAsync(() => getCuratedTiers(rank, lane), [rank, lane]);

  const grouped = useMemo(() => {
    if (heroes.status !== "success" || curated.status === "loading") return null;
    const tiers = curated.status === "success" ? curated.data : null;
    const filtered = heroes.data.filter((h) => {
      if (role !== null && !heroRoles(h).includes(role)) return false;
      // มีลิสต์ที่แอดมินจัด: แสดงเฉพาะฮีโร่ในลิสต์นั้น (ลิสต์รายเลนคือเลนนั้นอยู่แล้ว)
      if (tiers) return tiers.has(h.id);
      // fallback: tier จากสถิติ + กรองเลนจากอาร์เรย์ lanes
      return h.stat.hasStats && (lane === null || heroLanes(h).includes(lane));
    });
    const map = new Map<Tier, typeof filtered>();
    for (const t of TIER_ORDER) map.set(t, []);
    for (const h of filtered) map.get(tiers ? tiers.get(h.id)! : h.stat.tier)?.push(h);
    // เรียง A-Z ตามชื่ออังกฤษ ไม่เรียงตาม Win Rate เพื่อไม่ให้ลำดับในช่องดูเหมือนอันดับความแข็ง
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, "en"));
    return map;
  }, [heroes, curated, role, lane]);

  const isCurated = curated.status === "success" && curated.data !== null;
  const totalShown = grouped ? [...grouped.values()].reduce((n, l) => n + l.length, 0) : 0;
  const patchLabel = heroes.status === "success" ? heroes.data.find((h) => h.stat.hasStats)?.stat.patch ?? "—" : "—";
  const loading = heroes.status === "loading" || curated.status === "loading";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">Tier List</h1>
          <span className="text-xs text-text-faint">Patch {patchLabel} · {RANK_LABEL[rank]}</span>
        </div>
        <p className="mt-1 text-xs text-text-faint">
          {isCurated ? "Tier จัดโดยทีมงาน" : "Tier คำนวณจาก Win Rate ของแรงก์ที่เลือก"} · เรียง A–Z ในแต่ละ Tier · แตะไอคอนเพื่อดูข้อมูลฮีโร่
        </p>
      </div>

      <div className="space-y-2">
        <RoleFilterRow value={role} onChange={setRole} />
        <LaneFilterRow value={lane} onChange={setLane} />
      </div>

      {loading && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      )}
      {heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}
      {!loading && heroes.status === "success" && totalShown === 0 && (
        <EmptyState
          icon={BarChart3}
          title={isCurated || heroes.data.some((h) => h.stat.hasStats) ? "ไม่พบฮีโร่ในหมวดนี้" : "ยังไม่มีข้อมูลสถิติฮีโร่"}
          description={isCurated || heroes.data.some((h) => h.stat.hasStats) ? "ลองเปลี่ยนตัวกรอง Role หรือ Lane" : "ยังไม่มีสถิติสำหรับช่วงแรงก์ที่เลือก"}
        />
      )}
      {!loading && grouped && totalShown > 0 && (
        <div className="space-y-5">
          {TIER_ORDER.filter((t) => (grouped.get(t)?.length ?? 0) > 0).map((tier) => (
            <div key={tier}>
              <div className="mb-2 flex items-center gap-2">
                <Badge tier={tier} className="text-sm px-2.5 py-1">{tier}</Badge>
                <span className="text-xs text-text-faint">{grouped.get(tier)?.length} ฮีโร่</span>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                {grouped.get(tier)!.map((h) => (
                  <Link
                    key={h.id}
                    to={`/heroes/${h.slug}`}
                    aria-label={h.nameTh}
                    title={h.nameTh}
                    className="relative flex aspect-square w-full items-center justify-center rounded-lg bg-bg-raised font-display text-text-faint hover:ring-2 hover:ring-accent/40"
                  >
                    {h.icon ? (
                      <img
                        src={h.icon}
                        alt={h.nameTh}
                        loading="lazy"
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
                    <HeroBalanceBadge heroId={h.id} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
