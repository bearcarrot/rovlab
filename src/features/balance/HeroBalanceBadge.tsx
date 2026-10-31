import { BalanceIcon } from "./BalanceIcon";
import { useRecentBalance } from "./useRecentBalance";
import type { BalanceKind } from "@/services/balance";
import type { HeroSummary } from "@/types/hero";

type BadgeLook = {
  size?: "xs" | "sm" | "md";
  inside?: boolean;
};

// xs = ป้ายเล็กสำหรับไอคอนฮีโร่ขนาด ~40px (เช่นตาราง Tier List) — sm/md เดิมไม่เปลี่ยน
const BOX: Record<NonNullable<BadgeLook["size"]>, string> = { xs: "h-3.5 w-3.5", sm: "h-4 w-4", md: "h-6 w-6" };
const ICON: Record<NonNullable<BadgeLook["size"]>, string> = { xs: "h-2 w-2", sm: "h-2.5 w-2.5", md: "h-3.5 w-3.5" };

/** ส่วนวาดล้วน (ไม่มี hook) — หน้าที่โหลด recent balance ไว้ครั้งเดียวแล้วส่ง kind ลงมาเอง (เช่น Stats) ใช้ตัวนี้ */
export function BalanceBadge({ kind, size = "sm", inside = false }: BadgeLook & { kind: BalanceKind | null | undefined }) {
  if (!kind) return null;
  const box = BOX[size];
  const icon = ICON[size];
  const pos = inside ? (size === "xs" ? "bottom-0.5 right-0.5" : "bottom-1.5 right-1.5") : "-bottom-1 -right-1";
  return (
    <span
      className={`pointer-events-none absolute ${pos} z-10 flex ${box} items-center justify-center rounded-full bg-bg-surface shadow ring-1 ring-border`}
    >
      <BalanceIcon kind={kind} className={icon} />
    </span>
  );
}

/**
 * ไอคอน buff / nerf / adjust / rework มุมขวาล่างของรูปฮีโร่ — ใช้ตำแหน่งเดียวกันทุกหน้า
 * วางไว้ใน element ที่เป็น `relative` (กรอบรูปฮีโร่) — ไม่แสดงอะไรถ้าฮีโร่ไม่ได้ถูกปรับในแพตช์ล่าสุด
 * - size: xs (ไอคอนฮีโร่เล็ก ~40px เช่นตาราง Tier List) / sm (ไอคอนเล็กในรายการ) / md (การ์ดและหน้ารายละเอียด)
 * - inside: วางชิดในกรอบ ใช้กับกรอบที่ overflow-hidden (เช่นการ์ดฮีโร่) ไม่งั้นคร่อมขอบเล็กน้อย
 */
export function HeroBalanceBadge({ heroId, size, inside }: BadgeLook & { heroId: HeroSummary["id"] }) {
  const recent = useRecentBalance();
  return <BalanceBadge kind={recent?.get(heroId)} size={size} inside={inside} />;
}
