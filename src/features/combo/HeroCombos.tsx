import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/hooks/useAsync";
import { getHeroes } from "@/services/heroes";
import { listFeaturedCombosForHero } from "@/services/combos";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { LazySection } from "@/components/LazySection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboCard } from "./ComboCard";

// การ์ดในหน้ารายละเอียดฮีโร่: Combo แนะนำที่มีฮีโร่ตัวนี้ (2–5 ตัว) — แหล่งเดียวกับหน้า /combo (แท็บแนะนำ)
// โหลดเมื่อเลื่อนมาใกล้เท่านั้น (LazySection) เพื่อไม่ยิง user_combos + get_user_combo_meta ทุกครั้งที่เปิดหน้า
function HeroCombosCard({ heroId, heroName }: { heroId: string; heroName: string }) {
  const combos = useAsync(() => listFeaturedCombosForHero(heroId), [heroId]);
  const heroes = useAsync(() => getHeroes(), []);
  const byId = useMemo(() => new Map((heroes.status === "success" ? heroes.data : []).map((h) => [h.id, h] as const)), [heroes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Combo ของ {heroName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(combos.status === "loading" || heroes.status === "loading") && <Skeleton className="h-40" />}
        {combos.status === "error" && <ErrorState message={combos.message} onRetry={combos.refetch} />}
        {/* รายชื่อฮีโร่โหลดไม่สำเร็จ: เดิมการ์ดว่างเงียบๆ ต้องแจ้งและให้ลองใหม่ */}
        {combos.status !== "error" && heroes.status === "error" && <ErrorState message={heroes.message} onRetry={heroes.refetch} />}
        {combos.status === "success" && heroes.status === "success" && (
          combos.data.length === 0 ? (
            <p className="text-sm text-text-faint">ยังไม่มี Combo แนะนำของฮีโร่นี้</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 md:items-start">
              {combos.data.map((c) => <ComboCard key={c.id} combo={c} heroes={byId} featured />)}
            </div>
          )
        )}
        <Link to="/combo" className="inline-block text-sm text-accent">ดู Combo ทั้งหมดและสร้างของคุณ →</Link>
      </CardContent>
    </Card>
  );
}

export function HeroCombos(props: { heroId: string; heroName: string }) {
  return (
    <LazySection>
      <HeroCombosCard {...props} />
    </LazySection>
  );
}
