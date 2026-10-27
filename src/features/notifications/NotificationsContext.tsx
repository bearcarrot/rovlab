import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { countUnread, markAllNotificationsRead } from "@/services/community";

interface NotificationsValue {
  unread: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue>({
  unread: 0,
  refresh: async () => {},
  markAllRead: async () => {},
});

// Re-count while the tab is visible. Replaces a Supabase Realtime subscription, whose
// always-on replication poller was consuming the project's Disk IO budget.
const POLL_MS = 180_000;
// Coming back to the tab only re-counts if the last count is older than this (quick tab switches cost nothing).
const VISIBLE_MIN_MS = 30_000;

// One unread counter for the whole app (bell badge). Refreshes on mount, every POLL_MS while the
// tab is visible, and when the tab becomes visible again (if the last count is older than VISIBLE_MIN_MS).
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured } = useAuth();
  const userId = user?.id;
  const [unread, setUnread] = useState(0);
  const lastRefreshAt = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId || !isConfigured) {
      setUnread(0);
      return;
    }
    lastRefreshAt.current = Date.now();
    try {
      setUnread(await countUnread(userId));
    } catch {
      /* keep the previous count */
    }
  }, [userId, isConfigured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !isConfigured) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => void refresh(), POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastRefreshAt.current >= VISIBLE_MIN_MS) void refresh();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, isConfigured, refresh]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setUnread(0);
  }, [userId]);

  const value = useMemo(() => ({ unread, refresh, markAllRead }), [unread, refresh, markAllRead]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
