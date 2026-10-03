import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/layout/Skeleton";
import { authErrorMessage } from "@/features/auth/errors";
import { inputCls, linkBtnCls, primaryBtnCls } from "@/features/auth/styles";

// ลิงก์ในอีเมล reset จะ sign-in ชั่วคราวให้ แล้วหน้านี้ใช้ session นั้นเปลี่ยนรหัสผ่าน
export function ResetPassword() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Skeleton className="h-40" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="font-display text-xl font-semibold">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-sm text-text-muted">ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่</p>
        <Link to="/forgot-password" className={primaryBtnCls}>
          ขอลิงก์ตั้งรหัสผ่านใหม่
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร");
    if (password !== confirm) return setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
    setBusy(true);
    const { error: err, code } = await updatePassword(password);
    setBusy(false);
    if (err) setError(authErrorMessage(code));
    else navigate("/profile", { replace: true });
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="font-display text-xl font-semibold">ตั้งรหัสผ่านใหม่</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="รหัสผ่านใหม่"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="ยืนยันรหัสผ่านใหม่"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          บันทึกรหัสผ่านใหม่
        </button>
      </form>
      <Link to="/login" className={`block ${linkBtnCls}`}>
        กลับไปเข้าสู่ระบบ
      </Link>
    </div>
  );
}
