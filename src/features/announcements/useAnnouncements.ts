import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/ui/toast";
import { fetchMyDismissals, pushDismissals } from "@/services/announcements";
import type { Announcement } from "./types";
import { dismissAnnouncement, syncOnSignIn } from "./dismissals";
import { selectVisible } from "./visibility";
import {
  announcementStore,
  dismissalStore,
  getDismissed,
  notifyDismissalsChanged,
  subscribeDismissals,
} from "./store";

// Public banner data (spec sections 6, 7, 10): schedule-driven items + effective dismissed set, filtered and capped at 3.
export function useAnnouncements(): { shown: Announcement[]; more: Announcement[]; dismiss: (id: string) => Promise<void> } {
  const snap = useSyncExternalStore(announcementStore.subscribe, announcementStore.getSnapshot);
  const dismissed = useSyncExternalStore(subscribeDismissals, getDismissed);
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const toast = useToast();

  // Sign-in: adopt local-only dismissals, mirror the server's, retry pending ones. Also retried when the browser comes back online.
  useEffect(() => {
    if (uid === null) return;
    let alive = true;
    const run = () => {
      void syncOnSignIn({ store: dismissalStore, fetchServerIds: fetchMyDismissals, push: pushDismissals })
        .then(() => {
          if (alive) notifyDismissalsChanged();
        })
        .catch(() => {});
    };
    const onOnline = () => {
      if (dismissalStore.pending().length > 0) run();
    };
    run();
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
    };
  }, [uid]);

  const { shown, more } = useMemo(() => selectVisible(snap.items, snap.nowMs, dismissed), [snap.items, snap.nowMs, dismissed]);

  const dismiss = useCallback(
    async (id: string) => {
      // dismissAnnouncement writes the local store synchronously before its first await, so the card can be hidden right away.
      const pending = dismissAnnouncement(id, { store: dismissalStore, signedIn: uid !== null, push: pushDismissals });
      notifyDismissalsChanged();
      const result = await pending;
      // No success message (spec section 7); only report what actually failed.
      if (result.local === "failed" && result.server !== "ok") toast.error("ซ่อนได้เฉพาะรอบนี้");
      else if (result.server === "failed") toast.error("ยังบันทึกบนบัญชีไม่สำเร็จ จะลองใหม่");
    },
    [uid, toast],
  );

  return { shown, more, dismiss };
}
