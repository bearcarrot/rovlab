import { useState } from "react";
import { LogOut, LogIn, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getProfile, updatePreferredRoles } from "@/services/profile";
import { EmptyState } from "@/components/layout/EmptyState";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { ROLE_OPTIONS } from "@/features/heroes/HeroFilters";
import { cn } from "@/lib/utils";
import type { HeroRole } from "@/types/hero";

export function Profile() {
  const { user, isConfigured, signOut } = useAuth();
  const navigate = useNavigate();
  const profileQ = useAsync(() => (user ? getProfile(user.id) : Promise.resolve(null)), [user?.id]);
  const [savingRoles, setSavingRoles] = useState<HeroRole[]>([]);

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">โปรไฟล์</h1>
        <EmptyState icon={UserRound} title="ยังไม่ได้เชื่อม Supabase" description="ตั้งค่า .env เพื่อเปิดใช้งานระบบสมาชิก" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">โปรไฟล์</h1>
        <EmptyState icon={LogIn} title="ยังไม่ได้ล็อกอิน" description="เข้าสู่ระบบเพื่อดูและแก้ไขโปรไฟล์ของคุณ" />
        <Link to="/login" className="block text-center text-sm text-accent">ไปหน้าล็อกอิน →</Link>
      </div>
    );
  }

  async function toggleRole(role: HeroRole) {
    if (!user || profileQ.status !== "success" || !profileQ.data) return;
    const current = savingRoles.length ? savingRoles : (profileQ.data.preferredRoles as HeroRole[]);
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    setSavingRoles(next);
    await updatePreferredRoles(user.id, next);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-raised">
          <UserRound className="h-6 w-6 text-text-faint" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold">{user.email}</p>
          <p className="text-xs text-text-faint">สมาชิก RovLab</p>
        </div>
      </div>

      {profileQ.status === "loading" && <Skeleton className="h-24" />}
      {profileQ.status === "error" && <ErrorState message={profileQ.message} onRetry={profileQ.refetch} />}
      {profileQ.status === "success" && (
        <div>
          <p className="mb-2 text-sm font-medium">Role ที่ถนัด</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((r) => {
              const active = (savingRoles.length ? savingRoles : profileQ.data?.preferredRoles ?? []).includes(r.value);
              return (
                <button
                  key={r.value}
                  onClick={() => toggleRole(r.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium",
                    active ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted"
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={async () => {
          await signOut();
          navigate("/");
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm text-loss"
      >
        <LogOut className="h-4 w-4" />
        ออกจากระบบ
      </button>
    </div>
  );
}
