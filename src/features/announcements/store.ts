import { createAnnouncementStore, type PersistedAnnouncements } from "./schedule";
import { createDismissalStore, type DismissalStore, type StorageLike } from "./dismissals";
import { fetchActiveAnnouncements, fetchSchedule } from "@/services/announcements";
import { readSiteCache, writeSiteCache } from "@/lib/sitePersist";

// Thin glue (spec section 9): wires the pure schedule store and dismissal store to the services and the browser.
// Nothing runs at import time except constructing the stores; fetching and listeners start on the first subscriber.

export const announcementStore = createAnnouncementStore({
  fetchItems: fetchActiveAnnouncements,
  fetchSchedule,
  now: () => Date.now(),
  setTimer: (fn, ms) => window.setTimeout(fn, ms),
  clearTimer: (handle) => window.clearTimeout(handle as number),
  random: () => Math.random(),
  onVisible: (cb) => {
    const handler = () => {
      if (document.visibilityState === "visible") cb();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  },
  onOnline: (cb) => {
    window.addEventListener("online", cb);
    return () => window.removeEventListener("online", cb);
  },
  // Public rows only; skipped and wiped for admins (their RLS also returns drafts), see lib/sitePersist.ts.
  persist: {
    read: () => readSiteCache<PersistedAnnouncements>("announcements"),
    write: (state) => writeSiteCache("announcements", state),
  },
});

// Called by the admin tab after every mutation (spec section 6, step 6): refetch + re-arm the boundary timer.
export function invalidateAnnouncements(): Promise<void> {
  return announcementStore.invalidate();
}

// Reading window.localStorage can itself throw (blocked storage); the dismissal store then falls back to memory.
function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const dismissalStore: DismissalStore = createDismissalStore(browserStorage());

// The dismissal store is not reactive on its own. This keeps a cached Set (stable identity between changes) for
// useSyncExternalStore and replaces it whenever a dismissal is added or reconciled.
let dismissedSnapshot: Set<string> = dismissalStore.ids();
const dismissalListeners = new Set<() => void>();

export function subscribeDismissals(listener: () => void): () => void {
  dismissalListeners.add(listener);
  return () => {
    dismissalListeners.delete(listener);
  };
}

export function getDismissed(): Set<string> {
  return dismissedSnapshot;
}

export function notifyDismissalsChanged(): void {
  dismissedSnapshot = dismissalStore.ids();
  for (const l of [...dismissalListeners]) l();
}
