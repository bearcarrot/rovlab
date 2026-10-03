import { useState } from "react";
import { Heart, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useAsync } from "@/hooks/useAsync";
import { getHeroes } from "@/services/heroes";
import { HeroCard } from "@/features/heroes/HeroCard";
import { RoleFilterRow, LaneFilterRow } from "@/features/heroes/HeroFilters";
import { heroLanes, heroRoles } from "@/lib/heroPositions";
import { EmptyState } from "@/components/layout/EmptyState";
import { Skeleton } from "@/components/layout/Skeleton";
import type { HeroLane, HeroRole } from "@/types/hero";

export function Favorites() {
  const { user, isConfigured } = useAuth();
  const { favoriteSlugs, loading } = useFavorites();
  const heroesQ = useAsync(() => getHeroes(), []);
  const [role, setRole] = useState<HeroRole | null>(null);
  const [lane, setLane] = useState<HeroLane | null>(null);

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">รายการโปรด</h1>
        <EmptyState icon={Heart} title="ยังไม่ได้เชื่อม Supabase" description="เปิดใช้งานได้หลังตั้งค่า .env และล็อกอิน" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">รายการโปรด</h1>
        <EmptyState icon={LogIn} title="ต้องล็อกอินก่อน" description="เข้าสู่ระบบเพื่อบันทึกฮีโร่ที่ชอบไว้ดูภายหลัง" />
        <Link to="/login" className="block text-center text-sm text-accent">ไปหน้าล็อกอิน →</Link>
      </div>
    );
  }

  const favorites = heroesQ.status === "success" ? heroesQ.data.filter((h) => favoriteSlugs.has(h.slug)) : [];
  const heroes = favorites.filter(
    (h) => (role === null || heroRoles(h).includes(role)) && (lane === null || heroLanes(h).includes(lane))
  );

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">รายการโปรด</h1>
      {favorites.length > 0 && (
        <div className="space-y-2">
          <RoleFilterRow value={role} onChange={setRole} />
          <LaneFilterRow value={lane} onChange={setLane} />
        </div>
      )}
      {(loading || heroesQ.status === "loading") && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      )}
      {!loading && heroesQ.status === "success" && favorites.length === 0 && (
        <EmptyState icon={Heart} title="ยังไม่มีฮีโร่โปรด" description="กดรูปหัวใจที่การ์ดฮีโร่เพื่อบันทึกไว้ที่นี่" />
      )}
      {!loading && heroesQ.status === "success" && favorites.length > 0 && heroes.length === 0 && (
        <EmptyState icon={Heart} title="ไม่พบฮีโร่โปรดในหมวดนี้" description="ลองเปลี่ยนตัวกรอง Role หรือ Lane" />
      )}
      {!loading && heroes.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 xl:grid-cols-8">
          {heroes.map((h) => <HeroCard key={h.id} hero={h} compact />)}
        </div>
      )}
    </div>
  );
}
