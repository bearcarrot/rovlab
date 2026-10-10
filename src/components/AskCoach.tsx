import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { askCoach } from "@/services/ai";
import { useAuth } from "@/features/auth/AuthContext";
import { CoachIcon } from "@/components/CoachIcon";
import { CoachText } from "@/components/CoachText";
import { EllipsisJump } from "@/components/EllipsisJump";
import { useToast } from "@/components/ui/toast";

type Props = {
  prompt: string;
  context?: unknown;
  label?: string;
  /** เปลี่ยนค่านี้เมื่อข้อมูลที่เลือกเปลี่ยน เพื่อล้างคำตอบเก่า */
  resetKey?: string;
  /** แจ้งคำตอบล่าสุดให้หน้าแม่ (ส่ง "" เมื่อล้างคำตอบ) — ใช้กับการใส่ผล AI ในรูปแชร์ */
  onAdvice?: (text: string) => void;
  /** ใช้รูป CoachAi แทนไอคอน Sparkles (ทดสอบเฉพาะบางหน้า) */
  imageIcon?: boolean;
};

export function AskCoach({ prompt, context, label = "ถาม Coach Ai", resetKey, onAdvice, imageIcon }: Props) {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const reqId = useRef(0);
  const onAdviceRef = useRef(onAdvice);
  onAdviceRef.current = onAdvice;

  useEffect(() => {
    reqId.current++;
    setAdvice("");
    setBusy(false);
  }, [resetKey]);

  useEffect(() => {
    onAdviceRef.current?.(advice);
  }, [advice]);

  async function ask() {
    const id = ++reqId.current;
    setBusy(true);
    try {
      const text = await askCoach(prompt, context);
      if (id === reqId.current) setAdvice(text);
    } catch (e) {
      if (id === reqId.current) toast.error(e instanceof Error ? e.message : "ถาม Coach Ai ไม่สำเร็จ");
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <p className="text-xs text-text-faint">
        {imageIcon ? (
          <CoachIcon busy={false} image className="mr-1 inline-block h-5 w-5 align-text-bottom" />
        ) : (
          <Sparkles className="mr-1 inline h-3.5 w-3.5" />
        )}
        <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> เพื่อถาม Coach Ai
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={ask}
        disabled={busy}
        aria-busy={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-surface py-2 text-sm text-text hover:bg-bg-raised disabled:cursor-wait disabled:opacity-80"
      >
        {/* รูป mascot ละเอียดกว่าไอคอนเส้น: ต้องใหญ่ ~36px ถึงจะอ่านออกบนมือถือ */}
        <CoachIcon busy={busy} image={imageIcon} className={imageIcon ? "h-9 w-9" : "h-4 w-4"} />
        {busy && imageIcon ? (
          <span className="inline-flex items-baseline">
            กำลังคิด
            <EllipsisJump className="ml-1" />
          </span>
        ) : (
          <span className={busy ? "animate-pulse" : undefined}>{busy ? "กำลังคิด..." : advice ? "ถามใหม่" : label}</span>
        )}
      </button>
      {advice && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <CoachText text={advice} className="text-text" />
          <p className="mt-1.5 text-[11px] text-text-faint">* คำแนะนำจาก AI สร้างจากข้อมูลบนหน้านี้ อาจคลาดเคลื่อน</p>
        </div>
      )}
    </div>
  );
}
