import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// กล่องยืนยันก่อนทำสิ่งที่กู้คืนไม่ได้ (แทน window.confirm) — ผลลัพธ์ของการกระทำแจ้งทาง Toast (components/ui/toast.tsx)
// ใช้ Radix Dialog: จับ focus ในกล่อง, กด Esc ปิดได้, โฟกัสไปที่ปุ่ม "ยกเลิก" ก่อน (กันกด Enter ลบโดยพลาด)
// ระหว่าง busy (กำลังลบ) ปิดกล่องไม่ได้
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  destructive = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-card border border-border bg-bg-surface p-4 shadow-card focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div className="space-y-1.5">
            <Dialog.Title className="font-display text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="text-sm leading-relaxed text-text-muted">{description}</Dialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="min-h-11 rounded-lg border border-border bg-bg-raised px-4 py-2 text-sm font-medium text-text hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
                destructive ? "bg-loss text-white" : "bg-accent text-accent-fg"
              )}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
