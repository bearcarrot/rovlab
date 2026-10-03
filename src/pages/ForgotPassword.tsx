import { useState } from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { EmptyState } from "@/components/layout/EmptyState";
import { authErrorMessage } from "@/features/auth/errors";
import { useCooldown } from "@/features/auth/useCooldown";
import { inputCls, linkBtnCls, primaryBtnCls } from "@/features/auth/styles";

export function ForgotPassword() {
  const { sendPasswordReset, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldown = useCooldown("forgot-password", 60);

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="font-display text-xl font-semibold">ลืมรหัสผ่าน</h1>
        <EmptyState icon={UserRound} title="ยังไม่ได้เชื่อม Supabase" description="ต้องตั้งค่า Supabase ก่อนจึงจะใช้งานได้" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown.remaining > 0) return;
    setError(null);
    setBusy(true);
    const { code } = await sendPasswordReset(email);
    setBusy(false);
    // ข้อความเหมือนกันไม่ว่าอีเมลนี้จะมีบัญชีหรือไม่ — แจ้งเฉพาะกรณีโดน rate limit
    if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") {
      setError(authErrorMessage(code));
      return;
    }
    cooldown.start();
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="font-display text-xl font-semibold">ลืมรหัสผ่าน</h1>
      <p className="text-sm text-text-muted">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        {sent && (
          <p className="text-sm text-text-muted">
            หากอีเมลนี้มีบัญชีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมาย
          </p>
        )}
        <button type="submit" disabled={busy || cooldown.remaining > 0} className={primaryBtnCls}>
          {cooldown.remaining > 0 ? `ส่งอีกครั้งได้ใน ${cooldown.remaining} วินาที` : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
        </button>
      </form>

      <Link to="/login" className={`block ${linkBtnCls}`}>
        กลับไปเข้าสู่ระบบ
      </Link>
    </div>
  );
}
