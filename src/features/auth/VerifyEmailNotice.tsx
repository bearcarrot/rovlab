import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useCooldown } from "@/features/auth/useCooldown";
import { authErrorMessage } from "@/features/auth/errors";
import { outlineBtnCls } from "@/features/auth/styles";
import { useToast } from "@/components/ui/toast";

// แจ้งผู้ใช้ที่ล็อกอินแล้วแต่ยังไม่ยืนยันอีเมล (ใช้กับฟีเจอร์ชุมชน)
export function VerifyEmailNotice() {
  const { user, resendVerification } = useAuth();
  const toast = useToast();
  const cooldown = useCooldown("resend-verification", 60);
  const [busy, setBusy] = useState(false);

  async function resend() {
    if (!user?.email || busy || cooldown.remaining > 0) return;
    setBusy(true);
    const { error, code } = await resendVerification(user.email, window.location.pathname);
    setBusy(false);
    if (error) toast.error(authErrorMessage(code));
    else {
      cooldown.start();
      toast.success("ส่งอีเมลยืนยันแล้ว กรุณาตรวจสอบกล่องจดหมาย");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-bg-raised p-3 text-sm">
      <p className="flex items-start gap-2 text-text-muted">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>กรุณายืนยันอีเมลก่อนจึงจะแสดงความคิดเห็นหรือใช้ฟีเจอร์ชุมชนได้</span>
      </p>
      <button type="button" onClick={resend} disabled={busy || cooldown.remaining > 0} className={outlineBtnCls}>
        {cooldown.remaining > 0 ? `ส่งอีกครั้งได้ใน ${cooldown.remaining} วินาที` : "Resend verification email"}
      </button>
    </div>
  );
}
