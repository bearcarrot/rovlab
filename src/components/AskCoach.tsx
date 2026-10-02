import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { askCoach } from "@/services/ai";
import { useAuth } from "@/features/auth/AuthContext";
import { CoachIcon } from "@/components/CoachIcon";
import { CoachText } from "@/components/CoachText";

type Props = {
  prompt: string;
  context?: unknown;
  label?: string;
  /** เปลี่ยนค่านี้เมื่อข้อมูลที่เลือกเปลี่ยน เพื่อล้างคำตอบเก่า */
  resetKey?: string;
};

export function AskCoach({ prompt, context, label = "ถามโค้ช AI", resetKey }: Props) {
  const { user, loading } = useAuth();
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    reqId.current++;
    setAdvice("");
    setError("");
    setBusy(false);
  }, [resetKey]);

  async function ask() {
    const id = ++reqId.current;
    setBusy(true);
    setError("");
    try {
      const text = await askCoach(prompt, context);
      if (id === reqId.current) setAdvice(text);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : "ถาม AI ไม่สำเร็จ");
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <p className="text-xs text-text-faint">
        <Sparkles className="mr-1 inline h-3.5 w-3.5" />
        <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> เพื่อถามโค้ช AI
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={ask}
        disabled={busy}
        aria-busy={busy}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-surface py-2 text-sm text-text hover:bg-bg-raised disabled:cursor-wait disabled:opacity-80"
      >
        <CoachIcon busy={busy} className="h-4 w-4" />
        <span className={busy ? "animate-pulse" : undefined}>{busy ? "กำลังคิด..." : advice ? "ถามใหม่" : label}</span>
      </button>
      {advice && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <CoachText text={advice} className="text-text" />
          <p className="mt-1.5 text-[11px] text-text-faint">* คำแนะนำจาก AI สร้างจากข้อมูลบนหน้านี้ อาจคลาดเคลื่อน</p>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
