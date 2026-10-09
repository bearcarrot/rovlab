import { cn } from "@/lib/utils";

// จุด 3 จุดกระโดดสลับกัน ใช้เป็นสถานะกำลังโหลดต่อท้ายข้อความ (CSS ล้วน ไม่พึ่ง lib animation)
// สีตาม text color ของตัวแม่ (bg-current) และปิดแอนิเมชันเมื่อผู้ใช้ตั้ง reduce motion
export function EllipsisJump({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-end gap-[3px]", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1 w-1 rounded-full bg-current animate-dot-jump motion-reduce:animate-none"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
