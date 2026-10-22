import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { bangkokLocalToIso, isoToBangkokLocal } from "@/features/announcements/time";
import { MaintenancePage } from "@/features/maintenance/MaintenancePage";
import { invalidateMaintenance } from "@/features/maintenance/store";
import {
  ETA_MAX,
  MESSAGE_MAX,
  scheduleState,
  validateForm,
  type FetchResult,
  type FormValues,
  type MaintenanceConfig,
  type SaveInput,
  type ScheduleState,
} from "@/features/maintenance/schedule";
import { disableMaintenance, fetchMaintenance, saveMaintenance } from "@/services/maintenance";

// แท็บ "บำรุงรักษา" ในหน้า /admin — ปิดเว็บทั้งหมดตามช่วงเวลาที่ตั้งไว้ (เวลาไทย UTC+7, ช่วง [เริ่ม, สิ้นสุด))
// ทุกการเขียนผ่าน RPC ที่เช็ค is_admin() ฝั่งเซิร์ฟเวอร์ — หน้านี้แค่ซ่อน/แสดง ไม่ใช่ตัวคุมสิทธิ์

const BTN =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_PRIMARY = `${BTN} bg-accent text-accent-fg`;
const BTN_SECONDARY = `${BTN} border border-border bg-bg-raised text-text hover:border-text-faint`;
const INPUT =
  "w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-base outline-none placeholder:text-text-faint focus:border-accent sm:text-sm";

const STATE_LABEL: Record<ScheduleState, string> = {
  disabled: "ปิดใช้งานกำหนดการ",
  invalid: "ตั้งค่าไม่สมบูรณ์ (เว็บเปิดตามปกติ)",
  upcoming: "ตั้งเวลาไว้ — ยังไม่ถึงเวลาเริ่ม",
  active: "กำลังปิดปรับปรุงอยู่",
  ended: "สิ้นสุดช่วงปรับปรุงแล้ว",
};
const STATE_STYLE: Record<ScheduleState, string> = {
  disabled: "border-border bg-bg-raised text-text-muted",
  invalid: "border-loss/40 bg-loss/10 text-loss",
  upcoming: "border-accent/40 bg-accent/10 text-accent",
  active: "border-loss/40 bg-loss/10 text-loss",
  ended: "border-border bg-bg-raised text-text-faint",
};

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      })
    : "—";

const msg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function toValues(c: MaintenanceConfig): FormValues {
  return {
    enabled: c.enabled,
    startLocal: c.startsAt ? isoToBangkokLocal(c.startsAt) : "",
    endLocal: c.endsAt ? isoToBangkokLocal(c.endsAt) : "",
    message: c.message,
    etaNote: c.etaNote,
  };
}

function safeIso(local: string): string | null {
  try {
    return local.trim() === "" ? null : bangkokLocalToIso(local.trim());
  } catch {
    return null;
  }
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-text-faint">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-text-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

type Pending = { kind: "save"; input: SaveInput } | { kind: "disable" };

function Panel({ data, onChanged, onRefresh }: { data: FetchResult; onChanged: () => void; onRefresh: () => void }) {
  const toast = useToast();
  const uid = useId();
  const [v, setV] = useState<FormValues>(() => toValues(data.config));
  const [submitted, setSubmitted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setV((cur) => ({ ...cur, [key]: value }));

  const state = scheduleState(data.config, Date.parse(data.serverNow));
  const result = validateForm(v, bangkokLocalToIso, Date.now());
  const errors: Partial<Record<keyof FormValues, string>> = result.ok ? {} : result.errors;
  const err = (k: keyof FormValues) => (submitted ? errors[k] : undefined);

  // ตัวอย่างใช้ค่าในฟอร์มที่ยังไม่บันทึก และไม่แตะข้อมูลจริง (ไม่เรียก RPC ใดๆ)
  const draft: MaintenanceConfig = {
    enabled: true,
    startsAt: safeIso(v.startLocal),
    endsAt: safeIso(v.endLocal),
    message: v.message.trim(),
    etaNote: v.etaNote.trim(),
  };

  async function run(p: Pending) {
    if (busy) return;
    setBusy(true);
    try {
      if (p.kind === "save") {
        await saveMaintenance(p.input);
        toast.success(p.input.enabled ? "บันทึกและเปิดกำหนดการแล้ว" : "บันทึกแล้ว (กำหนดการยังปิดอยู่)");
      } else {
        await disableMaintenance();
        setV((cur) => ({ ...cur, enabled: false }));
        toast.success("ปิดกำหนดการแล้ว");
      }
      onChanged();
    } catch (e) {
      toast.error(msg(e, "ทำรายการไม่สำเร็จ"));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function onSave() {
    setSubmitted(true);
    if (busy || !result.ok) return;
    if (result.input.enabled) setPending({ kind: "save", input: result.input }); // เปิดกำหนดการ = กระทบผู้เข้าชม ต้องยืนยัน
    else void run({ kind: "save", input: result.input });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">บำรุงรักษา</h1>
          <p className="mt-1 text-xs text-text-faint">ปิดเว็บทั้งหมดตามช่วงเวลา · เวลาไทย (UTC+7) · ช่วง [เริ่ม, สิ้นสุด)</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="รีเฟรช"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5 rounded-card border border-border bg-bg-surface p-3">
        <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs leading-none", STATE_STYLE[state])}>{STATE_LABEL[state]}</span>
        <p className="text-[11px] text-text-faint">
          ที่บันทึกไว้: เริ่ม {fmt(data.config.startsAt)} · สิ้นสุด {fmt(data.config.endsAt)} (สถานะ ณ ตอนโหลดหน้านี้)
        </p>
      </div>

      <div className="space-y-4 rounded-card border border-border bg-bg-surface p-3">
        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-4 w-4 accent-[#E8A33D]" />
          เปิดใช้งานกำหนดการปิดปรับปรุง
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${uid}-start`} label="เริ่ม · เวลาไทย (UTC+7)" hint="เริ่มปิดเว็บ ณ นาทีนี้พอดี" error={err("startLocal")}>
            <input id={`${uid}-start`} type="datetime-local" value={v.startLocal} onChange={(e) => set("startLocal", e.target.value)} className={INPUT} />
          </Field>
          <Field id={`${uid}-end`} label="สิ้นสุด · เวลาไทย (UTC+7)" hint="เว็บกลับมาเปิดตั้งแต่นาทีนี้พอดี" error={err("endLocal")}>
            <input id={`${uid}-end`} type="datetime-local" value={v.endLocal} onChange={(e) => set("endLocal", e.target.value)} className={INPUT} />
          </Field>
        </div>

        <Field
          id={`${uid}-msg`}
          label={`ข้อความประกาศ (${[...v.message.trim()].length}/${MESSAGE_MAX})`}
          hint="เว้นว่าง = ใช้ข้อความมาตรฐาน"
          error={err("message")}
        >
          <textarea id={`${uid}-msg`} value={v.message} onChange={(e) => set("message", e.target.value)} rows={4} className={cn(INPUT, "resize-y")} />
        </Field>

        <Field
          id={`${uid}-eta`}
          label={`ข้อความเวลาเสร็จ (ไม่บังคับ ${[...v.etaNote.trim()].length}/${ETA_MAX})`}
          hint="แสดงใต้เวลาเปิดให้บริการ เช่น “อาจเสร็จเร็วกว่ากำหนด”"
          error={err("etaNote")}
        >
          <input id={`${uid}-eta`} value={v.etaNote} onChange={(e) => set("etaNote", e.target.value)} className={INPUT} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={onSave} disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกกำหนดการ"}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={() => setShowPreview((s) => !s)}>
          {showPreview ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {showPreview ? "ซ่อนตัวอย่าง" : "ดูตัวอย่างหน้าบำรุงรักษา"}
        </button>
        <button
          type="button"
          className={cn(BTN, "border border-loss/40 text-loss hover:bg-loss/10")}
          onClick={() => setPending({ kind: "disable" })}
          disabled={busy || !data.config.enabled}
        >
          ปิดกำหนดการ
        </button>
      </div>

      {showPreview && (
        <section aria-label="ตัวอย่างหน้าบำรุงรักษา" className="overflow-hidden rounded-card border border-border">
          <MaintenancePage config={draft} preview />
        </section>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending?.kind === "disable" ? "ปิดกำหนดการปิดปรับปรุง?" : "บันทึกและเปิดกำหนดการ?"}
        description={
          pending?.kind === "disable"
            ? "เว็บจะกลับมาเปิดตามปกติทันที (เวลาและข้อความที่ตั้งไว้ยังอยู่ เปิดใหม่ได้ภายหลัง)"
            : pending?.kind === "save"
              ? `ผู้เข้าชมทุกคนที่ไม่ใช่แอดมินจะเห็นหน้าปรับปรุงระบบตั้งแต่ ${fmt(pending.input.startsAt)} ถึงก่อน ${fmt(pending.input.endsAt)} (เวลาไทย)`
              : ""
        }
        confirmLabel={pending?.kind === "disable" ? "ปิดกำหนดการ" : "บันทึกและเปิด"}
        destructive={pending?.kind === "disable"}
        busy={busy}
        onConfirm={() => pending && void run(pending)}
      />
    </div>
  );
}

export function AdminMaintenance() {
  const q = useAsync(() => fetchMaintenance(), []);

  // หลังบันทึก/ปิด: โหลดค่าใหม่ในแท็บนี้ + ให้ gate ของเบราว์เซอร์นี้โหลดใหม่และตั้งเวลาใหม่
  function changed() {
    q.refetch();
    void invalidateMaintenance();
  }

  if (q.status === "loading") return <Skeleton className="h-64" />;
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  return <Panel data={q.data} onChanged={changed} onRefresh={q.refetch} />;
}
