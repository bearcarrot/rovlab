import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/layout/Skeleton";
import { withNext } from "@/features/auth/nav";

// ครอบ route ที่ต้องล็อกอิน — ถ้ายังไม่ล็อกอินพาไป /login?next=<หน้าเดิม>
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // CLS: สูงเท่า Suspense fallback ใน AppShell (min-h-[60vh]) กันขนาดกระโดด 160px → 60vh → เนื้อหาจริง
  if (loading) return <Skeleton className="min-h-[60vh]" />;
  if (!user) {
    return <Navigate to={withNext("/login", location.pathname + location.search)} replace />;
  }
  return <>{children}</>;
}
