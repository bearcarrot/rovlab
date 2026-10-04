import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { VerifyEmailNotice } from "@/features/auth/VerifyEmailNotice";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";
import { getComment, isAdmin as fetchIsAdmin, listComments, postComment } from "@/services/community";
import type { CommentRow, CommentSort } from "@/types/community";
import { cn } from "@/lib/utils";

const PAGE = 20;

export function CommentSection({ heroSlug }: { heroSlug: string }) {
  const { user, isVerified, isConfigured } = useAuth();
  const [params] = useSearchParams();
  const focusId = params.get("c");
  const canPost = Boolean(user && isVerified);

  const [sort, setSort] = useState<CommentSort>("top");
  const [items, setItems] = useState<CommentRow[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [admin, setAdmin] = useState(false);
  const [focusRoot, setFocusRoot] = useState<CommentRow | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    let cancelled = false;
    setStatus("loading");
    listComments({ heroSlug, sort, limit: PAGE + 1, offset: 0 })
      .then((rows) => {
        if (cancelled) return;
        setItems(rows.slice(0, PAGE));
        setHasMore(rows.length > PAGE);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [heroSlug, sort, version, user?.id, isConfigured]);

  useEffect(() => {
    if (!user || !isConfigured) {
      setAdmin(false);
      return;
    }
    let cancelled = false;
    fetchIsAdmin().then((v) => {
      if (!cancelled) setAdmin(v);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isConfigured]);

  // Deep link from a notification / share link: /heroes/:slug?c=<commentId>
  useEffect(() => {
    if (!isConfigured || !focusId) {
      setFocusRoot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const target = await getComment(heroSlug, focusId);
        const root = target?.parentId ? await getComment(heroSlug, target.parentId) : target;
        if (!cancelled) setFocusRoot(root);
      } catch {
        if (!cancelled) setFocusRoot(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [heroSlug, focusId, user?.id, isConfigured]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const rows = await listComments({ heroSlug, sort, limit: PAGE + 1, offset: items.length });
      setItems((prev) => [...prev, ...rows.slice(0, PAGE)]);
      setHasMore(rows.length > PAGE);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePost(body: string) {
    if (!user) throw new Error("login");
    await postComment({ userId: user.id, heroSlug, body });
    setSort("new");
    setVersion((v) => v + 1);
  }

  if (!isConfigured) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="ยังไม่ได้เชื่อม Supabase"
        description="ระบบความคิดเห็นต้องใช้ฐานข้อมูล ตั้งค่า .env เพื่อเปิดใช้งาน"
      />
    );
  }

  const visible = items.filter((i) => i.id !== focusRoot?.id);

  return (
    <div className="space-y-4">
      {canPost ? (
        <CommentComposer onSubmit={handlePost} />
      ) : user ? (
        <VerifyEmailNotice />
      ) : (
        <p className="text-sm text-text-muted">
          <Link to="/login" className="text-accent underline">เข้าสู่ระบบ</Link> เพื่อแสดงความคิดเห็น
        </p>
      )}

      <div className="flex gap-2">
        {(["top", "new"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              sort === s ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-muted"
            )}
          >
            {s === "top" ? "ยอดนิยม" : "ใหม่สุด"}
          </button>
        ))}
      </div>

      {focusRoot && focusId && (
        <div className="space-y-2 rounded-lg border border-accent/30 p-3">
          <p className="text-xs font-medium text-accent">ความคิดเห็นที่คุณเปิดมา</p>
          <CommentItem
            key={`${focusRoot.id}:${focusId}`}
            comment={focusRoot}
            heroSlug={heroSlug}
            isAdmin={admin}
            canPost={canPost}
            highlightId={focusId}
            defaultOpenReplies
          />
        </div>
      )}

      {status === "loading" && (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}
      {status === "error" && <ErrorState message="โหลดความคิดเห็นไม่สำเร็จ" onRetry={() => setVersion((v) => v + 1)} />}
      {status === "ready" && visible.length === 0 && !focusRoot && (
        <EmptyState icon={MessageCircle} title="ยังไม่มีความคิดเห็น" description="เป็นคนแรกที่แชร์เคล็ดลับของฮีโร่ตัวนี้" />
      )}
      {status === "ready" && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              heroSlug={heroSlug}
              isAdmin={admin}
              canPost={canPost}
              onGone={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore} className="w-full rounded-lg border border-border py-2 text-sm text-text-muted hover:text-text disabled:opacity-60">
              {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่ม"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
