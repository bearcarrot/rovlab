import { Admin } from "@/pages/Admin";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminImport } from "@/pages/AdminImport";
import { AdminImportBalance } from "@/pages/AdminImportBalance";
import { useIsAdmin } from "@/features/auth/useIsAdmin";
import { usePersistedState } from "@/hooks/usePersistedState";

type Mode = "dashboard" | "edit" | "import" | "balance";
const MODES: [Mode, string][] = [
  ["dashboard", "Dashboard"],
  ["edit", "แก้ไขข้อมูล"],
  ["import", "นำเข้าสถิติ"],
  ["balance", "นำเข้าปรับสมดุล"],
];

// หน้า /admin: สลับระหว่าง "Dashboard" (ภาพรวมการใช้งาน), "แก้ไขข้อมูล" (แท็บเดิม), "นำเข้าสถิติ" (getranklist.json) และ "นำเข้าปรับสมดุล" (getlatestadjustlist.json)
// คนที่ไม่ใช่แอดมินจะเห็นข้อความไม่มีสิทธิ์จาก <Admin /> เหมือนเดิม
// โหมดที่เปิดอยู่จำไว้ (sessionStorage) รีเฟรชแล้วกลับมาที่โหมดเดิม
export function AdminHub() {
  const { isAdmin } = useIsAdmin();
  const [saved, setMode] = usePersistedState<Mode>("admin:mode", "dashboard");
  const mode = MODES.some(([k]) => k === saved) ? saved : "dashboard";

  if (!isAdmin) return <Admin />;

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="โหมดแอดมิน"
        className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-bg-surface p-1 sm:max-w-2xl"
      >
        {MODES.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={`min-h-[44px] rounded-md px-1 text-xs leading-tight transition sm:text-sm ${
              mode === k ? "bg-accent font-medium text-accent-fg" : "text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "dashboard" ? (
        <AdminDashboard />
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
