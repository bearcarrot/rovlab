import type { ReactNode } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ผลลัพธ์ (แชร์แล้ว/ดาวน์โหลดแล้ว/ผิดพลาด) แจ้งด้วย toast กลางจาก useShareImage ปุ่มแสดงเฉพาะสถานะ busy/pending
// แถวเดียวกัน: [แชร์เป็นรูป] [extra เช่น ปุ่มแชร์ลิงก์] [ดาวน์โหลด PNG แบบไอคอน]
export function ShareImageButtons({
  busy,
  pending,
  onShare,
  onDownload,
  disabled,
  extra,
  className,
}: {
  busy: boolean;
  pending: boolean;
  onShare: () => void;
  onDownload: () => void;
  disabled?: boolean;
  /** ปุ่มเสริมในแถวเดียวกัน (เช่น ShareLinkButton) */
  extra?: ReactNode;
  className?: string;
}) {
  const common =
    "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        onClick={onShare}
        disabled={busy || disabled}
        aria-busy={busy}
        className={cn(common, "flex-1 border-accent bg-accent text-accent-fg hover:opacity-90 sm:flex-none sm:px-4")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        {busy ? "กำลังสร้างรูป..." : pending ? "แตะเพื่อแชร์" : "แชร์เป็นรูป"}
      </button>
      {extra}
      <button
        type="button"
        onClick={onDownload}
        disabled={busy || disabled}
        aria-label="ดาวน์โหลด PNG"
        title="ดาวน์โหลด PNG"
        className={cn(common, "shrink-0 border-border bg-bg-surface px-3 text-text hover:bg-bg-raised")}
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}
