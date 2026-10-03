import { ArrowLeftRight, Triangle } from "lucide-react";
import { HeroHelmetPlusIcon } from "@/components/HeroHelmetPlusIcon";
import { BALANCE_LABEL, type BalanceKind } from "@/services/balance";

// บัฟ = สามเหลี่ยมชี้ขึ้น (เขียว) · เนิฟ = สามเหลี่ยมชี้ลง (แดง)
// ปรับสมดุลทั่วไป = ลูกศรสลับซ้าย-ขวา (เหลือง) · รีเวิร์ก = หมวกฮีโร่ + เครื่องหมาย + (ส้ม)
export const BALANCE_YELLOW = "#eab308";
export const BALANCE_ORANGE = "#f97316";

export function BalanceIcon({ kind, className = "h-4 w-4" }: { kind: BalanceKind; className?: string }) {
  const label = BALANCE_LABEL[kind];
  if (kind === "buff")
    return <Triangle role="img" aria-label={label} className={`${className} text-win`} fill="currentColor" />;
  if (kind === "nerf")
    return <Triangle role="img" aria-label={label} className={`${className} rotate-180 text-loss`} fill="currentColor" />;
  if (kind === "rework")
    return <HeroHelmetPlusIcon role="img" aria-label={label} className={className} style={{ color: BALANCE_ORANGE }} />;
  return <ArrowLeftRight role="img" aria-label={label} className={className} style={{ color: BALANCE_YELLOW }} />;
}

// สีของป้าย/ขอบในการ์ดหน้ารายละเอียด
export const BALANCE_TEXT_CLASS: Record<BalanceKind, string> = {
  buff: "text-win",
  nerf: "text-loss",
  adjust: "",
  rework: "",
};
