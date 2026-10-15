import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getHeroItemUsage } from "@/services/itemStats";
import { SMALL_SAMPLE } from "@/features/build/itemUsage";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import type { HeroSummary } from "@/types/hero";
import type { ItemSummary } from "@/types/item";

const SHOWN = 12;

// Items real players ended their matches with, from users who chose to share. Shown next to (never mixed into) the curated build.
export function ItemUsage({ hero, items }: { hero: HeroSummary; items: ItemSummary[] }) {
  const { user, loading } = useAuth();
  const q = useAsync(() => (user ? getHeroItemUsage(hero.id) : Promise.resolve(null)), [hero.id, user?.id]);
  const bySlug = new Map(items.map((i) => [i.slug, i]));

  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <Users className="h-4 w-4 text-accent" />
      <h3 className="font-display text-sm font-semibold">ไอเทมที่ผู้เล่นใช้จริง: {hero.nameTh}</h3>
    </div>
  );
  const box = "space-y-2 rounded-lg border border-border bg-bg-surface p-3";

  if (loading || q.status === "loading") return <div className={box}>{head}<Skeleton className="h-24" /></div>;
  if (!user) {
    return (
      <div className={box}>
        {head}
        <p className="text-xs text-text-muted">
          <Link to="/login" className="text-accent">เข้าสู่ระบบ</Link> เพื่อดูสถิติไอเทมจากแมตช์ที่ผู้เล่นแชร์
        </p>
      </div>
    );
  }
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  if (q.status !== "success" || !q.data) return null;

  const u = q.data;
  if (u.suppressed || u.items.length === 0) {
    return (
      <div className={box}>
        {head}
        <p className="text-xs text-text-muted">
          ยังมีข้อมูลไม่พอสำหรับฮีโร่ตัวนี้ (ต้องมีผู้ร่วมแชร์อย่างน้อย 5 คน) คุณช่วยเพิ่มได้โดยติ๊กแชร์ไอเทมตอนบันทึกแมตช์ในหน้าวิเคราะห์เกม
        </p>
      </div>
    );
  }

  return (
    <div className={box}>
      {head}
      <p className="text-xs text-text-muted">
        จาก {u.eligible} แมตช์ ({u.users} ผู้เล่น){u.eligible < SMALL_SAMPLE && <span className="text-accent"> · ตัวอย่างยังน้อย ใช้ดูแนวโน้มเท่านั้น</span>}
      </p>
      <ul className="space-y-1.5">
        {u.items.slice(0, SHOWN).map((row) => {
          const it = bySlug.get(row.slug);
          return (
            <li key={row.itemId} className="flex items-center gap-2">
              {it?.icon ? (
                <img src={it.icon} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded border border-border" />
              ) : (
                <span className="h-8 w-8 shrink-0 rounded border border-border bg-bg-raised" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-text">{it?.nameTh ?? row.slug}</span>
                  <span className="shrink-0 tabular-nums text-text-muted">
                    <span className="font-semibold text-accent">{row.pickRate}%</span> · {row.matches}/{u.eligible}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-raised">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(row.pickRate, 100)}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-snug text-text-faint">
        % = สัดส่วนแมตช์ที่ผู้เล่นมีไอเทมนี้ครบในช่องสุดท้าย ไม่ใช่ตัวบอกว่าไอเทมทำให้ชนะ ข้อมูลมาจากผู้เล่นที่เลือกแชร์เท่านั้น
      </p>
    </div>
  );
}
