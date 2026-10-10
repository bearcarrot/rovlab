import { useEffect, useId, useRef, useState } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
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

type Phase = "idle" | "form" | "done";

// รีวิวคำตอบของ Coach Ai: 👍 ส่งทันที / 👎 เปิดช่องให้บอกว่าผิดตรงไหน แล้วส่งให้แอดมินตรวจ
// ส่งได้ครั้งเดียวต่อคำตอบ (ถามใหม่ = คำตอบใหม่ = รีวิวใหม่) ใช้ได้ทั้งในแชทลอยและปุ่มถามบนการ์ด
export function CoachFeedback({ question, answer, context, className }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sent, setSent] = useState<FeedbackRating | null>(null);
  const [pending, setPending] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  // แชทมี scroll เอง: เปิดฟอร์มแล้วเลื่อนให้เห็นครบ ไม่ให้ปุ่มส่งหลุดจอ
  useEffect(() => {
    if (phase === "form") formRef.current?.scrollIntoView({ block: "nearest" });
  }, [phase]);

  async function send(rating: FeedbackRating) {
    if (pending) return;
    setPending(rating);
    setError("");
    try {
      await submitCoachFeedback({ rating, question, answer, comment, context });
      setSent(rating);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setPending(null);
    }
  }

  if (phase === "done") {
    return (
      <p role="status" className={cn("flex items-center gap-1.5 text-xs text-text-muted", className)}>
        <Check className="h-3.5 w-3.5 shrink-0 text-win" aria-hidden />
        {sent === "like" ? "ขอบคุณสำหรับรีวิว" : "ส่งรายงานให้ทีมงานตรวจสอบแล้ว ขอบคุณที่ช่วยแจ้ง"}
      </p>
    );
  }

  const trimmed = comment.trim();
  const canSend = trimmed.length >= MIN_COMMENT && !pending;
  const BTN =
    "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 text-xs text-text transition " +
    "hover:border-text-faint active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted">คำตอบนี้ถูกต้องไหม?</span>
        <button
          type="button"
          onClick={() => void send("like")}
          disabled={!!pending}
          aria-label="ถูกต้อง (Like)"
          className={BTN}
        >
          <ThumbsUp className="h-4 w-4 text-win" aria-hidden /> ถูกต้อง
        </button>
        <button
          type="button"
          onClick={() => setPhase((p) => (p === "form" ? "idle" : "form"))}
          disabled={!!pending}
          aria-label="ไม่ถูกต้อง (Dislike)"
          aria-expanded={phase === "form"}
          className={cn(BTN, phase === "form" && "border-loss/50 bg-loss/10")}
        >
          <ThumbsDown className="h-4 w-4 text-loss" aria-hidden /> ไม่ถูก
        </button>
      </div>

      {phase === "form" && (
        <div ref={formRef} className="space-y-2 rounded-lg border border-loss/30 bg-loss/5 p-3">
          <label htmlFor={fieldId} className="block text-xs font-medium text-text">
            ผิดตรงไหน?
          </label>
          <textarea
            id={fieldId}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={MAX_COMMENT}
            rows={3}
            autoFocus
            placeholder="เช่น บอกว่าสกิล 2 ทำสตัน แต่จริงๆ เป็นแค่ชะลอ"
            className="w-full resize-none rounded-lg border border-border bg-bg-surface px-3 py-2 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm"
          />
          <div className="flex items-center justify-between gap-2 text-[11px] text-text-faint">
            <span>อย่าใส่ข้อมูลส่วนตัว · ทีมงานจะตรวจจากรายงานนี้</span>
            <span aria-hidden>
              {comment.length}/{MAX_COMMENT}
            </span>
          </div>
          {error && (
            <p role="alert" className="text-xs text-loss">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void send("dislike")}
              disabled={!canSend}
              className="inline-flex h-10 items-center rounded-lg bg-loss px-4 text-xs font-medium text-white transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {pending === "dislike" ? "กำลังส่ง..." : "ส่งรายงาน"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setError("");
              }}
              disabled={!!pending}
              className={BTN}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
      {phase === "idle" && error && (
        <p role="alert" className="text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}
