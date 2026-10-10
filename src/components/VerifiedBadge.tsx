import { BadgeCheck } from "lucide-react";
import { creatorLabel } from "@/lib/creator";

// ป้าย Verified Creator สีฟ้า วางต่อท้าย "ชื่อที่แสดง" (ไม่ใช่ handle)
// แสดงเฉพาะเมื่อ category มีค่า (ค่านี้มาจาก profiles.verified_category ที่แอดมินเท่านั้นตั้งได้)
export function VerifiedBadge({ category, className = "" }: { category?: string | null; className?: string }) {
  if (!category) return null;
  const label = `Verified Creator · ${creatorLabel(category)}`;
  return (
    <span role="img" aria-label={label} title={label} className={`inline-flex shrink-0 align-middle ${className}`}>
      <BadgeCheck className="h-4 w-4 fill-[#1d9bf0] text-white" aria-hidden />
    </span>
  );
}
