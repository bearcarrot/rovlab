import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { authCallbackUrl } from "@/features/auth/nav";

interface AuthResult {
  error: string | null;
  code?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  /** อีเมลยืนยันแล้ว (ใช้ auth.users.email_confirmed_at; Google ถือว่ายืนยันแล้ว) */
  isVerified: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    username: string,
    next?: string | null,
  ) => Promise<AuthResult & { needsVerification: boolean }>;
  signInWithGoogle: (next?: string | null) => Promise<AuthResult>;
  resendVerification: (email: string, next?: string | null) => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isConfigured: isSupabaseConfigured,
    isVerified: !!user?.email_confirmed_at,
    async signInWithEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null, code: error?.code };
    },
    async signUpWithEmail(email, password, username, next) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim(), display_name: username.trim() },
          emailRedirectTo: authCallbackUrl(next),
        },
      });
      if (error) return { error: error.message, code: error.code, needsVerification: false };
      // ถ้าอีเมลซ้ำ Supabase จะไม่ฟ้อง error (กันการเดาว่ามีบัญชี) — UI แสดงข้อความ "ตรวจสอบอีเมล" เหมือนกัน
      return { error: null, needsVerification: !data.user?.email_confirmed_at };
    },
    async signInWithGoogle(next) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authCallbackUrl(next) },
      });
      return { error: error?.message ?? null, code: error?.code };
    },
    async resendVerification(email, next) {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: authCallbackUrl(next) },
      });
      return { error: error?.message ?? null, code: error?.code };
    },
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error?.message ?? null, code: error?.code };
    },
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error?.message ?? null, code: error?.code };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
