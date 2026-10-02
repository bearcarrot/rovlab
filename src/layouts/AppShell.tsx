import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { Footer } from "@/components/layout/Footer";
import { useRank } from "@/lib/rank";

// App shell: persistent sidebar on desktop, header + bottom nav + slide-out
// drawer on mobile. Every route renders inside <Outlet/> here, followed by the
// shared footer (in normal flow; the footer carries the bottom-nav clearance).
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rank = useRank();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-x-hidden px-4 pb-8 pt-4 lg:px-6 lg:pt-6">
          {/* key={rank}: switching the all/high toggle remounts the page so every
              useAsync refetches stats for the new bucket (page-local UI state resets). */}
          <div key={rank}>
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
      <BottomNav onOpenDrawer={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
