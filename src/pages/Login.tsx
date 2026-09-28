import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { EmptyState } from "@/components/layout/EmptyState";

export function Login() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    const fn = mode === "signin" ? signInWithEmail : signUpWithEmail;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) setError(error);
    else navigate("/profile");
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="font-display text-xl font-semibold">{mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-text-faint focus:border-accent"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-text-faint focus:border-accent"
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-fg disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>
      </form>

      <button onClick={signInWithGoogle} className="w-full rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text">
        เข้าสู่ระบบด้วย Google
      </button>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="w-full text-center text-sm text-text-faint hover:text-text"
      >
        {mode === "signin" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ"}
      </button>
    </div>
  );
}
