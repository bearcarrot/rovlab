import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon for every "ask the AI coach" button: a spinner while the request is running, sparkles otherwise.
// `image` = ใช้รูป CoachAi แทน Sparkles (ทดสอบเฉพาะบางหน้า)
// ตอน busy ยังเป็น spinner เหมือนเดิม แต่วางในกล่องขนาดเท่ารูป เพื่อไม่ให้ปุ่มกระโดดและ spinner ไม่ใหญ่ตามรูป
export function CoachIcon({ busy, className, image }: { busy: boolean; className?: string; image?: boolean }) {
  if (image) {
    if (busy) {
      return (
        <span aria-hidden className={cn("flex shrink-0 items-center justify-center", className)}>
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </span>
      );
    }
    return (
      <img
        src="/CoachAi-64.webp"
        alt=""
        aria-hidden
        width={64}
        height={64}
        decoding="async"
        className={cn("shrink-0 object-contain", className)}
      />
    );
  }
  const Icon = busy ? Loader2 : Sparkles;
  return <Icon aria-hidden className={cn("text-accent", busy && "animate-spin", className)} />;
}
