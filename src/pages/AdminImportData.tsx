import { AdminImport } from "@/pages/AdminImport";
import { AdminImportBalance } from "@/pages/AdminImportBalance";
import { AdminImportSkills } from "@/pages/AdminImportSkills";
import { usePersistedState } from "@/hooks/usePersistedState";

type Kind = "rank" | "balance" | "skills";
const KINDS: [Kind, string][] = [
  ["rank", "สถิติแรงก์"],
  ["balance", "ปรับสมดุล"],
  ["skills", "สกิล"],
];

// แท็บ "นำเข้าข้อมูล": เลือกชนิดข้อมูลแล้วทำงานในหน้าเดียว (ดึงจากเกมโดยตรงหรือเลือกไฟล์ → ตรวจทาน → ยืนยัน)
// ชนิดที่เลือกจำไว้ (sessionStorage) เหมือนโหมดแอดมิน
export function AdminImportData() {
  const [saved, setKind] = usePersistedState<Kind>("admin:import-kind", "rank");
  const kind = KINDS.some(([k]) => k === saved) ? saved : "rank";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="ชนิดข้อมูลที่จะนำเข้า">
        {KINDS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-[44px] rounded-lg border px-2 text-sm transition ${
              kind === k ? "border-accent bg-accent/15 font-medium text-accent" : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "rank" ? <AdminImport /> : kind === "balance" ? <AdminImportBalance /> : <AdminImportSkills />}
    </div>
  );
}
