import { Navigate, useParams } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { resolveHandle } from "@/services/community";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";

// /u/:handle -> /players/:id (the existing public profile page)
export function UserByHandle() {
  const { handle = "" } = useParams();
  const q = useAsync(() => resolveHandle(handle), [handle]);

  if (q.status === "loading") return <Skeleton className="h-24" />;
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  if (q.status === "success" && q.data) return <Navigate to={`/players/${q.data}`} replace />;
  return <EmptyState icon={UserRound} title="ไม่พบผู้ใช้นี้" description="ชื่อผู้ใช้อาจไม่ถูกต้อง หรือผู้ใช้เปลี่ยนชื่อไปแล้ว" />;
}
