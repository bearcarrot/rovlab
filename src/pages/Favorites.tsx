import { Heart, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useAsync } from "@/hooks/useAsync";
import { getHeroes } from "@/services/heroes";
import { HeroCard } from "@/features/heroes/HeroCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { Skeleton } from "@/components/layout/Skeleton";

export function Favorites() {
  const { user, isConfigured } = useAuth();
  const { favoriteSlugs, loading } = useFavorites();
  const heroesQ = useAsync(() => getHeroes(), []);

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

  const heroes = heroesQ.status === "success" ? heroesQ.data.filter((h) => favoriteSlugs.has(h.slug)) : [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">รายการโปรด</h1>
      {(loading || heroesQ.status === "loading") && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
        </div>
      )}
      {!loading && heroesQ.status === "success" && heroes.length === 0 && (
        <EmptyState icon={Heart} title="ยังไม่มีฮีโร่โปรด" description="กดรูปหัวใจที่การ์ดฮีโร่เพื่อบันทึกไว้ที่นี่" />
      )}
      {!loading && heroes.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {heroes.map((h) => <HeroCard key={h.id} hero={h} />)}
        </div>
      )}
    </div>
  );
}
