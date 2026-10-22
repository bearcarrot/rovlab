import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { maintenanceStore } from "./store";
import { MaintenancePage } from "./MaintenancePage";

// Pages that stay reachable during maintenance so an admin can sign in (no redirects, hence no loops).
const OPEN_PATHS = new Set(["/login", "/forgot-password", "/reset-password"]);

// UX gate, not a security boundary: data stays protected by RLS exactly as before. Admins (is_admin RPC, same hook as the sidebar) pass through.
// While the store has no config yet, or a fetch failed with nothing cached, the site stays open (fail-open).
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const snap = useSyncExternalStore(maintenanceStore.subscribe, maintenanceStore.getSnapshot, maintenanceStore.getSnapshot);
  const { pathname } = useLocation();
  const { isAdmin, checking } = useIsAdmin();

  const path = pathname.replace(/\/+$/, "") || "/";
  const windowActive = snap.active && snap.config !== null && !OPEN_PATHS.has(path);
  const showPage = windowActive && !checking && !isAdmin;

  // Crawlers that run JS must not index the maintenance page as the real content of this URL.
  useEffect(() => {
    if (!showPage) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, [showPage]);

  if (!windowActive) return <>{children}</>;
  if (checking) return <div className="min-h-screen min-h-dvh bg-bg" aria-busy="true" />; // signed in: wait for the admin check, no flash of the page
  if (isAdmin) return <>{children}</>;
  return <MaintenancePage config={snap.config!} offsetMs={snap.offsetMs} />;
}
