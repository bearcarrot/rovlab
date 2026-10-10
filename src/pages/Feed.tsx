import { Link } from "react-router-dom";
import { Rss } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { getFollowingFeed } from "@/services/community";
import { getHeroes } from "@/services/heroes";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { timeAgo } from "@/lib/timeAgo";

export function Feed() {
  const { user, isConfigured } = useAuth();
  const q = useAsync(async () => {
    if (!user || !isConfigured) return null;
    const [items, heroes] = await Promise.all([getFollowingFeed(), getHeroes().catch(() => [])]);
    return { items, heroNames: new Map(heroes.map((h) => [h.slug, h.nameTh])) };
  }, [user?.id, isConfigured]);

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
        <EmptyState icon={Rss} title="ฟีดยังว่าง" description="กดติดตามผู้ใช้จากหน้าโปรไฟล์ผู้เล่น แล้วความคิดเห็นล่าสุดของเขาจะมาแสดงที่นี่" />
      )}
      {q.status === "success" && q.data && q.data.items.length > 0 && (
        <ul className="space-y-2">
          {q.data.items.map((i) => {
            const name = i.authorName?.trim() || i.handle;
            return (
              <li key={i.id}>
                <Link to={`/heroes/${i.heroSlug}?c=${i.id}`} className="flex gap-3 rounded-card border border-border bg-bg-surface p-3 hover:border-accent/40">
                  <UserAvatar name={name} url={i.avatarUrl} className="h-9 w-9 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="inline-flex items-center gap-1 align-middle">
                        <span className="font-medium">{name}</span>
                        <VerifiedBadge category={i.verifiedCategory} />
                      </span>{" "}
                      <span className="text-text-faint">
                        {i.parentId ? "ตอบกลับใน" : "แสดงความคิดเห็นใน"} {q.data!.heroNames.get(i.heroSlug) ?? i.heroSlug} · {timeAgo(i.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-text-muted">{i.body}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
