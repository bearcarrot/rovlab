import { useEffect, useRef } from "react";
import { Admin } from "@/pages/Admin";
import { AdminCoachFeedback } from "@/pages/AdminCoachFeedback";
import { AdminContact } from "@/pages/AdminContact";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminGameData } from "@/pages/AdminGameData";
import { AdminImport } from "@/pages/AdminImport";
import { AdminImportBalance } from "@/pages/AdminImportBalance";
import { AdminUsers } from "@/pages/AdminUsers";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { useAdminContactCount } from "@/features/auth/useAdminContactCount";
import { usePersistedState } from "@/hooks/usePersistedState";

type Mode = "dashboard" | "users" | "coach" | "contact" | "game" | "build" | "edit" | "import" | "balance";
const MODES: [Mode, string][] = [
  ["dashboard", "Dashboard"],
  ["users", "ผู้ใช้"],
  ["coach", "รีวิว Coach Ai"],
  ["contact", "ข้อความติดต่อ"],
  ["game", "ฐานข้อมูลเกม"],
  ["build", "บิลด์"],
  ["edit", "แก้ไขข้อมูล"],
  ["import", "นำเข้าสถิติ"],
  ["balance", "นำเข้าปรับสมดุล"],
];

// หน้า /admin: สลับระหว่าง "Dashboard" (ภาพรวมการใช้งาน), "ผู้ใช้" (จัดการผู้ใช้), "รีวิว Coach Ai" (รายงานคำตอบที่ผู้ใช้กดไม่ถูกใจ), "ข้อความติดต่อ" (กล่องจดหมายจากหน้า /contact พร้อม badge จำนวนข้อความใหม่), "ฐานข้อมูลเกม" (ไอเทม/รูน/สกิลชาเลนเจอร์/พลังแฝง พร้อมสถานะการยืนยัน), "บิลด์" (เลือกฮีโร่/บิลด์ครั้งเดียว แล้วแก้ข้อมูลบิลด์/ไอเทม/รูน/สกิลชาเลนเจอร์/พลังแฝงในหน้าเดียว), "แก้ไขข้อมูล" (แท็บที่เหลือ), "นำเข้าสถิติ" (getranklist.json) และ "นำเข้าปรับสมดุล" (getlatestadjustlist.json)
// คนที่ไม่ใช่แอดมินจะเห็นข้อความไม่มีสิทธิ์จาก <Admin /> เหมือนเดิม
// โหมดที่เปิดอยู่จำไว้ (sessionStorage) รีเฟรชแล้วกลับมาที่โหมดเดิม
export function AdminHub() {
  const { isAdmin } = useIsAdmin();
  const contactNew = useAdminContactCount();
  const [saved, setMode] = usePersistedState<Mode>("admin:mode", "dashboard");
  const mode = MODES.some(([k]) => k === saved) ? saved : "dashboard";
  const barRef = useRef<HTMLDivElement>(null);

  // บนมือถือแถบแท็บเลื่อนแนวนอนได้ (กันข้อความไทยยาวไม่มีช่องว่างล้น/ถูกตัด) เลื่อนให้แท็บที่เปิดอยู่มาอยู่กลางแถบ
  useEffect(() => {
    const bar = barRef.current;
    const el = bar?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (bar && el) bar.scrollTo({ left: el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [mode, isAdmin]);

  if (!isAdmin) return <Admin group="rest" />;

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
              {k === "contact" && contactNew > 0 && (
                <>
                  <span
                    aria-hidden="true"
                    className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 align-middle text-[10px] font-semibold leading-none text-white"
                  >
                    {contactNew > 99 ? "99+" : contactNew}
                  </span>
                  <span className="sr-only"> มีข้อความใหม่ {contactNew} รายการ</span>
                </>
              )}
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
      ) : mode === "contact" ? (
        <AdminContact />
      ) : mode === "game" ? (
        <AdminGameData />
      ) : mode === "build" ? (
        <Admin group="build" />
      ) : mode === "edit" ? (
        <Admin group="rest" />
      ) : mode === "import" ? (
        <AdminImport />
      ) : (
        <AdminImportBalance />
      )}
    </div>
  );
}
