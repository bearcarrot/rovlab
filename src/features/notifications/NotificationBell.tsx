import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useNotifications } from "./NotificationsContext";

export function NotificationBell() {
  const { user, isConfigured } = useAuth();
  const { unread } = useNotifications();
  if (!user || !isConfigured) return null;
  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-bg-raised text-text-muted hover:text-text"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-semibold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
