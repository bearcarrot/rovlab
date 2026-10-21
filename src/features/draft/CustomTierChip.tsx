import type { CustomTier } from "./customTier";

// ป้ายเทียร์ของทีม: ชื่อแถว + สีที่ผู้ใช้ตั้งเอง (ใช้ Badge เดิมไม่ได้ เพราะ Badge ผูกกับสีของ S+/S/A/B/C)
export function CustomTierChip({ tier, className = "" }: { tier: CustomTier; className?: string }) {
  return (
    <span
      title={tier.label}
      style={{ backgroundColor: tier.color, color: tier.fg }}
      className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none ${className}`}
    >
      {tier.label}
    </span>
  );
}
