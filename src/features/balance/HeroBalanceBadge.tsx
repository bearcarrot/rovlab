import { BalanceIcon } from "./BalanceIcon";
import { useRecentBalance } from "./useRecentBalance";

/**
 * ไอคอน buff / nerf / adjust / rework มุมขวาล่างของรูปฮีโร่
 * วางไว้ใน element ที่เป็น `relative` (กรอบรูปฮีโร่) — ไม่แสดงอะไรถ้าฮีโร่ไม่ได้ถูกปรับในแพตช์ล่าสุด
 */
export function HeroBalanceBadge({ heroId }: { heroId: string }) {
  const recent = useRecentBalance();
  const kind = recent?.get(heroId);
  if (!kind) return null;
  return (
    <span className="pointer-events-none absolute -bottom-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-bg-surface shadow ring-1 ring-border">
      <BalanceIcon kind={kind} className="h-2.5 w-2.5" />
    </span>
  );
}
