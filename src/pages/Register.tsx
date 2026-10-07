import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, UserPlus, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { EmptyState } from "@/components/layout/EmptyState";
import { GOOGLE_CLIENT_ID, GoogleIdTokenButton } from "@/components/GoogleIdTokenButton";
import { useToast } from "@/components/ui/toast";
import { safeNext, withNext } from "@/features/auth/nav";
import { authErrorMessage } from "@/features/auth/errors";
import { validateEmail } from "@/features/auth/email";
import { checkUsernameAvailable, validateUsername } from "@/features/auth/username";
import { useCooldown } from "@/features/auth/useCooldown";
import { inputCls, linkBtnCls, outlineBtnCls, primaryBtnCls } from "@/features/auth/styles";

export function Register() {
  const { user, signUpWithEmail, resendVerification, isConfigured } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submitted = useRef(false);
  const cooldown = useCooldown("resend-verification", 60);

  // ล็อกอินอยู่แล้ว → ออกจากหน้า Register (ยกเว้นกำลังแสดงผลสมัครสำเร็จ)
  useEffect(() => {
    if (user && !submitted.current) navigate(next ?? "/profile", { replace: true });
  }, [user, next, navigate]);

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="font-display text-xl font-semibold">สมัครสมาชิก</h1>
        <EmptyState
          icon={UserRound}
          title="ยังไม่ได้เชื่อม Supabase"
          description="ใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env เพื่อเปิดใช้งานระบบสมัครสมาชิก"
        />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const uErr = validateUsername(username);
    if (uErr) return setError(uErr);
    const eErr = validateEmail(email);
    if (eErr) return setError(eErr);
    if (password.length < 6) return setError("รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร");
    if (password !== confirm) return setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");

    const cleanEmail = email.trim();
    setBusy(true);
    submitted.current = true;
    if (!(await checkUsernameAvailable(username))) {
      submitted.current = false;
      setBusy(false);
      return setError("Username นี้ถูกใช้แล้วหรือใช้ไม่ได้ กรุณาเลือกชื่ออื่น");
    }
    const res = await signUpWithEmail(cleanEmail, password, username, next);
    setBusy(false);
    if (res.error) {
      submitted.current = false;
      return setError(authErrorMessage(res.code, "สมัครสมาชิกไม่สำเร็จ ลองเปลี่ยน Username หรือลองใหม่อีกครั้ง"));
    }
    setEmail(cleanEmail);
    if (res.needsVerification) {
      cooldown.start();
      setDone(true);
    } else {
      navigate(next ?? "/profile", { replace: true });
    }
  }

  async function handleResend() {
    if (busy || cooldown.remaining > 0) return;
    setError(null);
    setBusy(true);
    const { error: err, code } = await resendVerification(email, next);
    setBusy(false);
    if (err) setError(authErrorMessage(code));
    else {
      cooldown.start();
      toast.success("ส่งอีเมลยืนยันอีกครั้งแล้ว");
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-raised p-4">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="space-y-1">
            <h1 className="font-display text-base font-semibold">สมัครสมาชิกสำเร็จ</h1>
            <p className="text-sm text-text-muted">
              กรุณาตรวจสอบ Email เพื่อยืนยันบัญชี (ส่งไปที่ <span className="break-all text-text">{email}</span>)
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-loss">{error}</p>}
        <button type="button" onClick={handleResend} disabled={busy || cooldown.remaining > 0} className={outlineBtnCls}>
          {cooldown.remaining > 0 ? `ส่งอีกครั้งได้ใน ${cooldown.remaining} วินาที` : "Resend verification email"}
        </button>
        <button
          type="button"
          onClick={() => {
            submitted.current = false;
            setDone(false);
          }}
          className={outlineBtnCls}
        >
          Change email
        </button>
        <Link to={withNext("/login", next)} className={`block ${linkBtnCls}`}>
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="font-display text-xl font-semibold">สมัครสมาชิก</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="space-y-1">
          <input
            type="text"
            maxLength={20}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls}
          />
          <p className="text-[11px] text-text-faint">3–20 ตัวอักษร ใช้ a-z, 0-9 และ _ ได้</p>
        </div>
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="อีเมล (เช่น name@example.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="ยืนยันรหัสผ่าน"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          <UserPlus className="h-4 w-4" />
          สมัครสมาชิก
        </button>
      </form>

      {GOOGLE_CLIENT_ID && (
        <GoogleIdTokenButton
          text="signup_with"
          onBusyChange={setBusy}
          onError={(code) => setError(authErrorMessage(code))}
        />
      )}

      <Link to={withNext("/login", next)} className={`block ${linkBtnCls}`}>
        มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
      </Link>
    </div>
  );
}
