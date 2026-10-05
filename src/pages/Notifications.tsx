import { Link } from "react-router-dom";
import { AtSign, Bell, MessageCircle, ThumbsUp, UserPlus, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { useAsync } from "@/hooks/useAsync";
import { listNotifications, markNotificationRead } from "@/services/community";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/layout/Skeleton";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";
import type { NotificationItem, NotificationType } from "@/types/community";

const META: Record<NotificationType, { icon: LucideIcon; text: string }> = {
  mention: { icon: AtSign, text: "แท็กคุณในความคิดเห็น" },
  reply: { icon: MessageCircle, text: "ตอบกลับความคิดเห็นของคุณ" },
  like: { icon: ThumbsUp, text: "ถูกใจความคิดเห็นของคุณ" },
  follow: { icon: UserPlus, text: "เริ่มติดตามคุณ" },
};

function hrefFor(n: NotificationItem): string {
  if (n.type === "follow") return `/players/${n.actorId}`;
  if (n.heroSlug && n.commentId) return `/heroes/${n.heroSlug}?c=${n.commentId}`;
  return "/";
}

export function Notifications() {
  const { user } = useAuth();
  const { refresh, markAllRead } = useNotifications();
  const toast = useToast();
  const q = useAsync(() => (user ? listNotifications() : Promise.resolve<NotificationItem[]>([])), [user?.id]);

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      q.refetch();
      toast.success("ทำเครื่องหมายอ่านทั้งหมดแล้ว");
    } catch {
      toast.error("ทำเครื่องหมายอ่านทั้งหมดไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">การแจ้งเตือน</h1>
        <div className="flex items-center gap-3 text-xs">
          <Link to="/feed" className="text-text-muted hover:text-text">ฟีดคนที่ติดตาม</Link>
          <button onClick={() => void handleMarkAllRead()} className="text-accent">
            อ่านทั้งหมด
          </button>
        </div>
      </div>

      {q.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      )}
      {q.status === "error" && <ErrorState message={q.message} onRetry={q.refetch} />}
      {q.status === "success" && q.data.length === 0 && (
        <EmptyState icon={Bell} title="ยังไม่มีการแจ้งเตือน" description="เมื่อมีคนแท็ก ตอบกลับ ถูกใจ หรือติดตามคุณ จะแสดงที่นี่" />
      )}
      {q.status === "success" && q.data.length > 0 && (
        <ul className="space-y-2">
          {q.data.map((n) => {
            const { icon: Icon, text } = META[n.type];
            const who = n.actorName?.trim() || n.actorHandle;
            return (
              <li key={n.id}>
                <Link
                  to={hrefFor(n)}
                  onClick={() => {
                    if (!n.readAt) void markNotificationRead(n.id).then(refresh);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-card border bg-bg-surface p-3 hover:border-accent/40",
                    n.readAt ? "border-border" : "border-accent/40"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{who}</span> <span className="text-text-muted">{text}</span>
                    </p>
                    <p className="text-xs text-text-faint">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="ยังไม่อ่าน" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
