import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { Avatar } from "@/features/community/Avatar";
import { getFollowCounts, getFollowState, getProfileByHandle, getUserComments, setFollow } from "@/services/community";
import { getHeroes } from "@/services/heroes";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";
import { timeAgo } from "@/lib/time";

export function PublicProfile() {
  const { handle = "" } = useParams();
  const { user, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [busy, setBusy] = useState(false);

  const q = useAsync(async () => {
    if (!isConfigured) return null;
    const p = await getProfileByHandle(handle);
    if (!p) return null;
    const [counts, comments, isFollowing, heroes] = await Promise.all([
      getFollowCounts(p.id),
      getUserComments(p.id),
      user && user.id !== p.id ? getFollowState(user.id, p.id) : Promise.resolve(false),
      getHeroes().catch(() => []),
    ]);
    const heroNames = new Map(heroes.map((h) => [h.slug, h.nameTh]));
    return { p, counts, comments, isFollowing, heroNames };
  }, [handle, user?.id, isConfigured]);

  const data = q.status === "success" ? q.data : null;
  useEffect(() => {
    if (data) {
      setFollowing(data.isFollowing);
      setFollowers(data.counts.followers);
    }
  }, [data]);

  if (!isConfigured) {
    return <EmptyState icon={UserRound} title="ยังไม่ได้เชื่อม Supabase" description="ตั้งค่า .env เพื่อเปิดใช้งานโปรไฟล์สาธารณะ" />;
  }
  if (q.status === "loading") return <Skeleton className="h-40" />;
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  if (!q.data) return <EmptyState icon={UserRound} title="ไม่พบผู้ใช้นี้" description="ตรวจสอบชื่อผู้ใช้อีกครั้ง" />;

  const { p, counts, comments, heroNames } = q.data;
  const isMe = user?.id === p.id;

  async function toggleFollow() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    setFollowers((n) => n + (next ? 1 : -1));
    try {
      await setFollow(user.id, p.id, next);
    } catch {
      setFollowing(!next);
      setFollowers((n) => n + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar handle={p.handle} url={p.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold">@{p.handle}</h1>
          <p className="text-sm text-text-muted">
            ผู้ติดตาม {followers.toLocaleString()} · กำลังติดตาม {counts.following.toLocaleString()}
          </p>
        </div>
        {!isMe && (
          <button
            onClick={toggleFollow}
            disabled={busy}
            className={following ? "rounded-lg border border-border px-4 py-2 text-sm text-text-muted" : "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg"}
          >
            {following ? "กำลังติดตาม" : "ติดตาม"}
          </button>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-display text-base font-semibold">ความคิดเห็นล่าสุด</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-text-faint">ยังไม่มีความคิดเห็น</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id}>
                <Link to={`/heroes/${c.heroSlug}?c=${c.id}`} className="block rounded-card border border-border bg-bg-surface p-3 hover:border-accent/40">
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-text-muted">{c.body}</p>
                  <p className="mt-1 text-xs text-text-faint">
                    ใน {heroNames.get(c.heroSlug) ?? c.heroSlug} · {timeAgo(c.createdAt)} · 👍 {c.likeCount}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
