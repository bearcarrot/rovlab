import { useEffect, useRef } from "react";
import { Admin } from "@/pages/Admin";
import { AdminCoachFeedback } from "@/pages/AdminCoachFeedback";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminImport } from "@/pages/AdminImport";
import { AdminImportBalance } from "@/pages/AdminImportBalance";
import { AdminUsers } from "@/pages/AdminUsers";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { usePersistedState } from "@/hooks/usePersistedState";

type Mode = "dashboard" | "users" | "coach" | "edit" | "import" | "balance";
const MODES: [Mode, string][] = [
  ["dashboard", "Dashboard"],
  ["users", "ผู้ใช้"],
  ["coach", "รีวิว Coach Ai"],
  ["edit", "แก้ไขข้อมูล"],
  ["import", "นำเข้าสถิติ"],
  ["balance", "นำเข้าปรับสมดุล"],
];

// หน้า /admin: สลับระหว่าง "Dashboard" (ภาพรวมการใช้งาน), "ผู้ใช้" (จัดการผู้ใช้), "แก้ไขข้อมูล" (แท็บเดิม), "นำเข้าสถิติ" (getranklist.json) และ "นำเข้าปรับสมดุล" (getlatestadjustlist.json)
// คนที่ไม่ใช่แอดมินจะเห็นข้อความไม่มีสิทธิ์จาก <Admin /> เหมือนเดิม
// โหมดที่เปิดอยู่จำไว้ (sessionStorage) รีเฟรชแล้วกลับมาที่โหมดเดิม
export function AdminHub() {
  const { isAdmin } = useIsAdmin();
  const [saved, setMode] = usePersistedState<Mode>("admin:mode", "dashboard");
  const mode = MODES.some(([k]) => k === saved) ? saved : "dashboard";
  const barRef = useRef<HTMLDivElement>(null);

  // บนมือถือแถบแท็บเลื่อนแนวนอนได้ (กันข้อความไทยยาวไม่มีช่องว่างล้น/ถูกตัด) เลื่อนให้แท็บที่เปิดอยู่มาอยู่กลางแถบ
  useEffect(() => {
    const bar = barRef.current;
    const el = bar?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (bar && el) bar.scrollTo({ left: el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [mode, isAdmin]);

  if (!isAdmin) return <Admin />;

  return (
    <div className="space-y-4">
      <div ref={barRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          role="tablist"
          aria-label="โหมดแอดมิน"
          className="relative flex w-max min-w-full gap-1 rounded-lg border border-border bg-bg-surface p-1"
        >
          {MODES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={`min-h-[44px] flex-1 shrink-0 whitespace-nowrap rounded-md px-3 text-xs transition sm:text-sm ${
                mode === k ? "bg-accent font-medium text-accent-fg" : "text-text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "dashboard" ? (
        <AdminDashboard />
      ) : mode === "users" ? (
        <AdminUsers />
      ) : mode === "coach" ? (
        <AdminCoachFeedback />
      ) : mode === "edit" ? (
        <Admin />
      ) : mode === "import" ? (
        <AdminImport />
      ) : (
        <AdminImportBalance />
      )}
    </div>
  );
}
