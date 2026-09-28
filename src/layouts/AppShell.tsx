import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileDrawer } from "@/components/layout/MobileDrawer";

// App shell: persistent sidebar on desktop, header + bottom nav + slide-out
// drawer on mobile. Every route renders inside <Outlet/> here.
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-x-hidden px-4 pb-24 pt-4 lg:px-6 lg:pb-8 lg:pt-6">
          <Outlet />
        </main>
      </div>
      <BottomNav onOpenDrawer={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
