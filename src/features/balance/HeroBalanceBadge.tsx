import { BalanceIcon } from "./BalanceIcon";
import { useRecentBalance } from "./useRecentBalance";
import type { HeroSummary } from "@/types/hero";

/**
 * ไอคอน buff / nerf / adjust / rework มุมขวาล่างของรูปฮีโร่ — ใช้ตำแหน่งเดียวกันทุกหน้า
 * วางไว้ใน element ที่เป็น `relative` (กรอบรูปฮีโร่) — ไม่แสดงอะไรถ้าฮีโร่ไม่ได้ถูกปรับในแพตช์ล่าสุด
 * - size: sm (ไอคอนเล็กในรายการ) / md (การ์ดและหน้ารายละเอียด)
 * - inside: วางชิดในกรอบ ใช้กับกรอบที่ overflow-hidden (เช่นการ์ดฮีโร่) ไม่งั้นคร่อมขอบเล็กน้อย
 */
export function HeroBalanceBadge({
  heroId,
  size = "sm",
  inside = false,
}: {
  heroId: HeroSummary["id"];
  size?: "sm" | "md";
  inside?: boolean;
}) {
  const recent = useRecentBalance();
  const kind = recent?.get(heroId);
  if (!kind) return null;
  const box = size === "md" ? "h-6 w-6" : "h-4 w-4";
  const icon = size === "md" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  const pos = inside ? "bottom-1.5 right-1.5" : "-bottom-1 -right-1";
  return (
    <span
      className={`pointer-events-none absolute ${pos} z-10 flex ${box} items-center justify-center rounded-full bg-bg-surface shadow ring-1 ring-border`}
    >
      <BalanceIcon kind={kind} className={icon} />
    </span>
  );
}
