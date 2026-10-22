import { createMaintenanceStore } from "./schedule";
import { fetchMaintenance } from "@/services/maintenance";

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
});

// Called by the admin tab after save/disable: refetch + re-arm the boundary timer (this browser only; other visitors pick the change
// up at their next boundary/recheck/visibility refresh, at most MAX_AGE_MS later).
export function invalidateMaintenance(): Promise<void> {
  return maintenanceStore.invalidate();
}
