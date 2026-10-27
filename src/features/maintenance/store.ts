import { createMaintenanceStore, type PersistedMaintenance } from "./schedule";
import { fetchMaintenance } from "@/services/maintenance";
import { readSiteCache, writeSiteCache } from "@/lib/sitePersist";

// Thin glue: nothing runs at import time except constructing the store; fetching, the timer and the listeners start on the first subscriber.
export const maintenanceStore = createMaintenanceStore({
  fetchConfig: fetchMaintenance,
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
  // A full reload within 5 minutes reuses the last answer (never one showing maintenance as active), see lib/sitePersist.ts.
  persist: {
    read: () => readSiteCache<PersistedMaintenance>("maintenance"),
    write: (state) => writeSiteCache("maintenance", state),
  },
});

// Called by the admin tab after save/disable: refetch + re-arm the boundary timer (this browser only; other visitors pick the change
// up at their next boundary/recheck/visibility refresh, at most MAX_AGE_MS later; with the reload cache, a reload within 5 minutes
// of their last fetch can still show the old answer).
export function invalidateMaintenance(): Promise<void> {
  return maintenanceStore.invalidate();
}
