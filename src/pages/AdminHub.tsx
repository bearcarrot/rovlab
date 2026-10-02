import { useState } from "react";
import { Admin } from "@/pages/Admin";
import { AdminImport } from "@/pages/AdminImport";
import { useIsAdmin } from "@/features/auth/useIsAdmin";

// หน้า /admin: สลับระหว่าง "แก้ไขข้อมูล" (แท็บเดิม) กับ "นำเข้าสถิติจากไฟล์"
// คนที่ไม่ใช่แอดมินจะเห็นข้อความไม่มีสิทธิ์จาก <Admin /> เหมือนเดิม
export function AdminHub() {
  const { isAdmin } = useIsAdmin();
  const [mode, setMode] = useState<"edit" | "import">("edit");

  if (!isAdmin) return <Admin />;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="โหมดแอดมิน" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-surface p-1">
        {(
          [
            ["edit", "แก้ไขข้อมูล"],
            ["import", "นำเข้าสถิติจากไฟล์"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={`h-11 rounded-md text-sm transition ${
              mode === k ? "bg-accent font-medium text-accent-fg" : "text-text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "edit" ? <Admin /> : <AdminImport />}
    </div>
  );
}
