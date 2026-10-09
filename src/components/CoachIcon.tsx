import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon for every "ask the AI coach" button: a spinner while the request is running, sparkles otherwise.
// `image` = ใช้รูป CoachAi แทน Sparkles (ทดสอบเฉพาะบางหน้า)
// โหมดรูปแสดงรูปตลอด ไม่สลับเป็น spinner — ปุ่มบอกสถานะ busy เองด้วย <EllipsisJump /> ที่ข้อความ
export function CoachIcon({ busy, className, image }: { busy: boolean; className?: string; image?: boolean }) {
  if (image) {
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
