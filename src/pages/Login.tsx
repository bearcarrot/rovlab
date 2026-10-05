import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { EmptyState } from "@/components/layout/EmptyState";
import { GoogleIcon } from "@/components/GoogleIcon";
import { useToast } from "@/components/ui/toast";
import { safeNext, withNext } from "@/features/auth/nav";
import { authErrorMessage } from "@/features/auth/errors";
import { validateEmail } from "@/features/auth/email";
import { useCooldown } from "@/features/auth/useCooldown";
import { inputCls, linkBtnCls, outlineBtnCls, primaryBtnCls } from "@/features/auth/styles";

export function Login() {
  const { user, signInWithEmail, signInWithGoogle, resendVerification, isConfigured } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown("resend-verification", 60);

  // ล็อกอินอยู่แล้ว (รวมถึงกลับมาจากลิงก์ยืนยันอีเมล / Google) → ไปหน้าที่ตั้งใจจะเข้า หรือโปรไฟล์
  useEffect(() => {
    if (user) navigate(next ?? "/profile", { replace: true });
  }, [user, next, navigate]);

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="font-display text-xl font-semibold">เข้าสู่ระบบ</h1>
        <EmptyState
          icon={UserRound}
          title="ยังไม่ได้เชื่อม Supabase"
          description="ใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env เพื่อเปิดใช้งานระบบล็อกอิน ระหว่างนี้ใช้งานแบบ Guest ได้ตามปกติ"
        />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    if (!password) return setError("กรุณากรอกรหัสผ่าน");
    setBusy(true);
    const { error: err, code } = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (err) {
      if (code === "email_not_confirmed") setUnverified(true);
      setError(authErrorMessage(code));
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    const { error: err, code } = await signInWithGoogle(next);
    // สำเร็จ: เบราว์เซอร์จะถูก redirect ไป Google เอง
    if (err) {
      setError(authErrorMessage(code));
      setBusy(false);
    }
  }

  async function handleResend() {
    if (busy || cooldown.remaining > 0) return;
    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);
    setError(null);
    setBusy(true);
    const { error: err, code } = await resendVerification(email.trim(), next);
    setBusy(false);
    if (err) setError(authErrorMessage(code));
    else {
      cooldown.start();
      toast.success("ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบกล่องจดหมาย");
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="font-display text-xl font-semibold">เข้าสู่ระบบ</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        {unverified && (
          <button type="button" onClick={handleResend} disabled={busy || cooldown.remaining > 0} className={outlineBtnCls}>
            {cooldown.remaining > 0 ? `ส่งอีกครั้งได้ใน ${cooldown.remaining} วินาที` : "Resend verification email"}
          </button>
        )}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          <LogIn className="h-4 w-4" />
          เข้าสู่ระบบ
        </button>
      </form>

      <Link to="/forgot-password" className={`block ${linkBtnCls}`}>
        ลืมรหัสผ่าน?
      </Link>

      <button type="button" onClick={handleGoogle} disabled={busy} className={outlineBtnCls}>
        <GoogleIcon />
        เข้าสู่ระบบด้วย Google
      </button>

      <Link to={withNext("/register", next)} className={`block ${linkBtnCls}`}>
        ยังไม่มีบัญชี? สมัครสมาชิก
      </Link>
    </div>
  );
}
