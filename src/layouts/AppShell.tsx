import { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CoachChatProvider } from "@/features/coach/CoachChatContext";
import { CoachFab } from "@/features/coach/CoachFab";
import { useRank } from "@/lib/rank";

// App shell: persistent sidebar on desktop, header + bottom nav + slide-out
// drawer on mobile. Every route renders inside <Outlet/> here, followed by the
// shared footer (in normal flow; the footer carries the bottom-nav clearance).
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rank = useRank();
  const { pathname } = useLocation();

  return (
    <CoachChatProvider>
      <div className="flex min-h-screen min-h-dvh bg-bg">
        <ScrollToTop />
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onOpenDrawer={() => setDrawerOpen(true)} />
          <main className="flex-1 overflow-x-hidden px-4 pb-8 pt-4 sm:px-5 lg:px-6 lg:pt-6">
            {/* key={rank}: switching the all/high toggle remounts the page so every
                useAsync refetches stats for the new bucket (page-local UI state resets).
                max-w-6xl: ไม่ให้เนื้อหายืดเต็มจอในหน้าจอกว้างมาก
                ErrorBoundary: หน้าไหนพังตอน render จะขึ้นข้อความ error แทนจอดำ และล้างเมื่อเปลี่ยน route
                Suspense: หน้าอื่นโหลดแบบ lazy ระหว่างโหลดให้ shell (เมนู/หัว/ท้าย) ยังอยู่คงที่ */}
            <div key={rank} className="mx-auto w-full max-w-6xl">
              <ErrorBoundary resetKey={pathname}>
                <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
          <Footer />
        </div>
        <BottomNav onOpenDrawer={() => setDrawerOpen(true)} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        {/* ปุ่มลอย Coach Ai: โผล่เฉพาะหน้าที่ลงทะเบียน Quick Chat (ตอนนี้: รายละเอียดฮีโร่) */}
        <CoachFab />
      </div>
    </CoachChatProvider>
  );
}
