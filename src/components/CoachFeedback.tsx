import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { MAX_COMMENT, MIN_COMMENT, submitCoachFeedback, type FeedbackRating } from "@/services/coachFeedback";
import { cn } from "@/lib/utils";

type Props = {
  /** คำถามที่ผู้ใช้กด (label ของ Quick Chat หรือ prompt) */
  question: string;
  answer: string;
  /** ข้อมูลที่ส่งให้ AI ตอนถาม: ส่งไปเก็บเฉพาะตอนกดไม่ถูก เพื่อให้แอดมินตรวจย้อนหลังได้ */
  context?: unknown;
  className?: string;
};

// รีวิวคำตอบของ Coach Ai แบบเดียวกับ Claude: ไอคอน 👍 👎 เล็กๆ สีกลาง วางใต้กล่องข้อความ
// 👍 ส่งทันที / 👎 เปิด modal ให้บอกว่าผิดตรงไหนแล้วส่งให้แอดมินตรวจ
// ส่งได้ครั้งเดียวต่อคำตอบ (ถามใหม่ = คำตอบใหม่ = รีวิวใหม่) ใช้ได้ทั้งในแชทลอยและปุ่มถามบนการ์ด
export function CoachFeedback({ question, answer, context, className }: Props) {
  const [sent, setSent] = useState<FeedbackRating | null>(null);
  const [pending, setPending] = useState<FeedbackRating | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const fieldId = useId();

  async function send(rating: FeedbackRating) {
    if (pending || sent) return;
    setPending(rating);
    setError("");
    try {
      await submitCoachFeedback({ rating, question, answer, comment, context });
      setSent(rating);
      setFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setPending(null);
    }
  }

  const canSend = comment.trim().length >= MIN_COMMENT && !pending;
  const ICON_BTN =
    "flex h-8 w-8 items-center justify-center rounded-md text-text-faint transition " +
    "hover:bg-bg-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
    "disabled:pointer-events-none disabled:opacity-60";

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={() => void send("like")}
        disabled={!!pending || !!sent}
        aria-label="ถูกต้อง"
        aria-pressed={sent === "like"}
        title="ถูกต้อง"
        className={cn(ICON_BTN, sent === "like" && "text-text disabled:opacity-100")}
      >
        <ThumbsUp className={cn("h-4 w-4", sent === "like" && "fill-current")} aria-hidden />
      </button>

      <Dialog.Root
        open={formOpen}
        onOpenChange={(o) => {
          if (pending) return;
          setFormOpen(o);
          if (!o) setError("");
        }}
      >
        <Dialog.Trigger asChild>
          <button
            type="button"
            disabled={!!pending || !!sent}
            aria-label="ไม่ถูก"
            aria-pressed={sent === "dislike"}
            title="ไม่ถูก"
            className={cn(ICON_BTN, sent === "dislike" && "text-text disabled:opacity-100")}
          >
            <ThumbsDown className={cn("h-4 w-4", sent === "dislike" && "fill-current")} aria-hidden />
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-2xl border border-border bg-bg-surface p-4 shadow-card outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Dialog.Title className="font-display text-base font-semibold">ผิดตรงไหน?</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-text-faint">
                  บอกเราว่าคำตอบนี้ไม่ถูกตรงไหน ทีมงานจะตรวจสอบและแก้ไข
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="ปิด" className="rounded-lg p-1.5 text-text-muted hover:bg-bg-raised hover:text-text">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <label htmlFor={fieldId} className="sr-only">
              ผิดตรงไหน
            </label>
            <textarea
              id={fieldId}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={MAX_COMMENT}
              rows={4}
              placeholder="เช่น บอกว่าสกิล 2 ทำสตัน แต่จริงๆ เป็นแค่ชะลอ"
              className="w-full resize-none rounded-lg border border-border bg-bg-raised px-3 py-2 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm"
            />
            <div className="flex items-center justify-between gap-2 text-[11px] text-text-faint">
              <span>อย่าใส่ข้อมูลส่วนตัว</span>
              <span aria-hidden>
                {comment.length}/{MAX_COMMENT}
              </span>
            </div>
            {error && (
              <p role="alert" className="text-xs text-loss">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close
                disabled={!!pending}
                className="inline-flex h-10 items-center rounded-lg border border-border bg-bg-raised px-4 text-sm text-text transition hover:border-text-faint disabled:opacity-50"
              >
                ยกเลิก
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void send("dislike")}
                disabled={!canSend}
                className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {pending === "dislike" ? "กำลังส่ง..." : "ส่งรายงาน"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {sent && (
        <span role="status" className="ml-1.5 text-xs text-text-faint">
          {sent === "like" ? "ขอบคุณสำหรับรีวิว" : "ส่งให้ทีมงานตรวจสอบแล้ว"}
        </span>
      )}
      {!formOpen && error && (
        <span role="alert" className="ml-1.5 text-xs text-loss">
          {error}
        </span>
      )}
    </div>
  );
}
