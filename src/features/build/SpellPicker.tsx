import { Loader2, X } from "lucide-react";
import { Thumb } from "@/features/admin/ImageSelect";

// ตัวเลือกสกิลชาเลนเจอร์ของบิลด์ — ส่วนแสดงผลล้วน ใช้ร่วมกันทั้งหน้าแอดมิน (เขียน DB ทันที) และตัวสร้างบิลด์ของผู้ใช้ (เก็บใน state จนกด "บันทึกบิลด์")
// ตัวนี้ไม่แตะ Supabase และไม่ตรวจสิทธิ์: ผู้เรียกเป็นคนเขียนข้อมูลและรับผิดชอบสิทธิ์เอง

export interface SpellOpt {
  id: string;
  name: string;
  nameTh: string;
  description: string;
  cooldownSeconds: number | null;
  icon?: string;
  /** เลือกใหม่ได้หรือไม่ (ใช้งานในเกมจริง) — ตัวที่เลือกอยู่แล้วแต่ pickable=false ยังกดเพื่อเอาออกได้ */
  pickable: boolean;
  /** บรรทัดสถานะใต้ชื่อของสกิลที่เลือกอยู่ (เช่น ผลการยืนยันกับเกมจริง) */
  note?: string;
}

export function SpellPicker({
  spells,
  value,
  onChange,
  busyId = null,
  disabled = false,
  emptyText = "ยังไม่มีสกิลชาเลนเจอร์ในฐานข้อมูล",
  emptyCurrentText = "ยังไม่ได้เลือกสกิลชาเลนเจอร์",
}: {
  spells: SpellOpt[];
  value: string | null;
  onChange: (spellId: string | null) => void;
  /** id ของสกิลที่กำลังบันทึก หรือ "clear" ขณะล้าง (แสดงวงหมุน) */
  busyId?: string | null;
  disabled?: boolean;
  emptyText?: string;
  emptyCurrentText?: string;
}) {
  const current = spells.find((s) => s.id === value) ?? null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-raised p-3">
        {current ? (
          <>
            <Thumb src={current.icon} label={current.name} round className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {current.name} <span className="text-text-muted">· {current.nameTh}</span>
              </p>
              <p className="text-xs text-text-faint">
                {current.cooldownSeconds != null ? `คูลดาวน์ ${current.cooldownSeconds} วิ` : ""}
                {current.cooldownSeconds != null && current.note ? " · " : ""}
                {current.note ?? ""}
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-loss/40 bg-loss/10 px-3 text-sm text-loss hover:bg-loss/20 disabled:opacity-50"
            >
              {busyId === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              ล้าง
            </button>
          </>
        ) : (
          <p className="text-sm text-text-faint">{emptyCurrentText}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {spells.map((s) => {
          const selected = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              disabled={disabled || (!s.pickable && !selected)}
              aria-pressed={selected}
              title={s.pickable ? s.description : "สกิลนี้ยังไม่เปิดใช้ในเกมจริง (inactive / Test Server)"}
              onClick={() => onChange(selected ? null : s.id)}
              className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border bg-bg p-2 text-center transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                selected ? "border-accent ring-2 ring-accent" : "border-border"
              }`}
            >
              {busyId === s.id ? (
                <Loader2 className="h-10 w-10 animate-spin text-text-faint" />
              ) : (
                <Thumb src={s.icon} label={s.name} round className="h-10 w-10" />
              )}
              <span className="w-full truncate text-xs font-medium leading-tight">{s.name}</span>
              <span className="w-full truncate text-[10px] leading-tight text-text-faint">{s.nameTh}</span>
            </button>
          );
        })}
        {spells.length === 0 && <p className="col-span-full py-4 text-center text-sm text-text-muted">{emptyText}</p>}
      </div>
    </div>
  );
}
