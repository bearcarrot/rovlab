import { Download, Loader2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ผลลัพธ์ (แชร์แล้ว/ดาวน์โหลดแล้ว/ผิดพลาด) แจ้งด้วย toast กลางจาก useShareImage ปุ่มแสดงเฉพาะสถานะ busy/pending
export function ShareImageButtons({
  busy,
  pending,
  onShare,
  onDownload,
  disabled,
  className,
}: {
  busy: boolean;
  pending: boolean;
  onShare: () => void;
  onDownload: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-4";
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        onClick={onShare}
        disabled={busy || disabled}
        aria-busy={busy}
        className={cn(base, "border-accent bg-accent text-accent-fg hover:opacity-90")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        {busy ? "กำลังสร้างรูป..." : pending ? "แตะเพื่อแชร์" : "แชร์เป็นรูป"}
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={busy || disabled}
        className={cn(base, "border-border bg-bg-surface text-text hover:bg-bg-raised")}
      >
        <Download className="h-4 w-4" />
        ดาวน์โหลด PNG
      </button>
    </div>
  );
}
