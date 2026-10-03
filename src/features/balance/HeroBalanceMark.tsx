import { BalanceIcon } from "./BalanceIcon";
import { useRecentBalance } from "./useRecentBalance";

// ไอคอนบัฟ/เนิฟ/ปรับ/รีเวิร์กล่าสุดของฮีโร่ (แสดงเฉพาะช่วงที่ยังใหม่) — ไม่มีข้อมูลก็ไม่แสดงอะไร
// ใส่ className ตำแหน่งเอง เช่น "absolute right-1 top-1" เมื่อวางทับไอคอนฮีโร่
export function HeroBalanceMark({ heroId, className = "" }: { heroId: string; className?: string }) {
  const kind = useRecentBalance()?.get(heroId);
  if (!kind) return null;
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-bg-surface/90 shadow ${className}`}>
      <BalanceIcon kind={kind} className="h-3 w-3" />
    </span>
  );
}
