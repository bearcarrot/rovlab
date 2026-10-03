import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabase";
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

// One unread counter for the whole app (bell badge). Live-updates via Supabase Realtime.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured } = useAuth();
  const userId = user?.id;
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId || !isConfigured) {
      setUnread(0);
      return;
    }
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
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
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
