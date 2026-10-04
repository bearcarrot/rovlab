import { Link } from "react-router-dom";
import { LogIn, Rss } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { Avatar } from "@/features/community/Avatar";
import { getFollowingFeed } from "@/services/community";
import { getHeroes } from "@/services/heroes";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";
import { timeAgo } from "@/lib/time";

export function Feed() {
  const { user, isConfigured } = useAuth();
  const q = useAsync(async () => {
    if (!user || !isConfigured) return null;
    const [items, heroes] = await Promise.all([getFollowingFeed(), getHeroes().catch(() => [])]);
    return { items, heroNames: new Map(heroes.map((h) => [h.slug, h.nameTh])) };
  }, [user?.id, isConfigured]);

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">ฟีดคนที่ติดตาม</h1>
        <EmptyState icon={Rss} title="ยังไม่ได้เชื่อม Supabase" description="ตั้งค่า .env เพื่อเปิดใช้งานฟีด" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">ฟีดคนที่ติดตาม</h1>
        <EmptyState icon={LogIn} title="ต้องล็อกอินก่อน" description="เข้าสู่ระบบเพื่อดูความคิดเห็นล่าสุดจากคนที่คุณติดตาม" />
        <Link to="/login" className="block text-center text-sm text-accent">ไปหน้าล็อกอิน →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">ฟีดคนที่ติดตาม</h1>
      {q.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}
      {q.status === "success" && (!q.data || q.data.items.length === 0) && (
        <EmptyState icon={Rss} title="ฟีดยังว่าง" description="ติดตามผู้ใช้จากหน้าโปรไฟล์ แล้วความคิดเห็นล่าสุดของเขาจะมาแสดงที่นี่" />
      )}
      {q.status === "success" && q.data && q.data.items.length > 0 && (
        <ul className="space-y-2">
          {q.data.items.map((i) => (
            <li key={i.id}>
              <Link to={`/heroes/${i.heroSlug}?c=${i.id}`} className="flex gap-3 rounded-card border border-border bg-bg-surface p-3 hover:border-accent/40">
                <Avatar handle={i.handle} url={i.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-medium">@{i.handle}</span>{" "}
                    <span className="text-text-faint">
                      {i.parentId ? "ตอบกลับใน" : "แสดงความคิดเห็นใน"} {q.data!.heroNames.get(i.heroSlug) ?? i.heroSlug} · {timeAgo(i.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-text-muted">{i.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
