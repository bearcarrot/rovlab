import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";

// Admin card for /api/publish-data (docs/r2-data-snapshots.md): publish the hero data snapshot to R2, see what is live,
// roll back to an earlier generation, or switch a dataset off (visitors then read Supabase again).

type Entry = { key: string; count: number; bytes: number; schema: number };
type Manifest = { generation: number; generatedAt: string; datasets: Record<string, Entry> };
type Reply = { ok?: boolean; error?: string; message?: string; changed?: boolean; manifest?: Manifest | null; results?: Record<string, string> };

const DATASETS = ["heroes", "hero-text"];

const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const card = "space-y-3 rounded-card border border-border bg-bg-surface p-4 shadow-card";

async function call(body: Record<string, unknown>): Promise<Reply & { status: number }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, error: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบใหม่" };
  const res = await fetch("/api/publish-data", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as Reply;
  return { ...j, status: res.status };
}

export function PublishDataCard() {
  const toast = useToast();
  const toastRef = useRef(toast); // keep the latest toast without making refresh() change identity on every render
  toastRef.current = toast;
  const [manifest, setManifest] = useState<Manifest | null | undefined>(undefined); // undefined = not loaded yet
  const [busy, setBusy] = useState(false);
  const [rollbackTo, setRollbackTo] = useState("");

  const refresh = useCallback(async () => {
    const r = await call({ action: "status" });
    if (r.status === 200) setManifest(r.manifest ?? null);
    else toastRef.current.error(r.message ?? "อ่านสถานะไม่สำเร็จ");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    const r = await call(body);
    setBusy(false);
    if (r.status === 200) {
      toast.success(r.changed === false ? "ข้อมูลเหมือนเดิม ไม่มีอะไรเปลี่ยน" : ok);
      await refresh();
    } else {
      toast.error(r.message ?? "ทำรายการไม่สำเร็จ");
    }
  }

  return (
    <section className={card}>
      <h2 className="font-display text-base font-semibold">เผยแพร่ข้อมูลฮีโร่ไปที่ R2 (Snapshot)</h2>
      <p className="text-xs text-text-muted">
        สร้างไฟล์ JSON จากข้อมูลสาธารณะใน Supabase แล้วอัปโหลดไป assets.rovlab.app · ผู้ใช้ทั่วไปจะเห็นข้อมูลใหม่ภายในไม่กี่นาทีหลังเผยแพร่ ·
        ต้องเปิด VITE_R2_SNAPSHOTS=1 บน Vercel ก่อนเว็บจะอ่านจาก R2 · ถ้ามีปัญหาให้ปิด dataset หรือย้อนกลับ ระบบจะกลับไปอ่านจาก Supabase เอง
      </p>

      <div className="rounded-lg border border-border text-xs">
        {manifest === undefined ? (
          <p className="p-3 text-text-muted">กำลังอ่านสถานะ...</p>
        ) : manifest === null ? (
          <p className="p-3 text-text-muted">ยังไม่เคยเผยแพร่ (เว็บอ่านจาก Supabase ทั้งหมด)</p>
        ) : (
          <>
            <p className="border-b border-border p-3 text-text-muted">
              Generation {manifest.generation} · {new Date(manifest.generatedAt).toLocaleString("th-TH")}
            </p>
            {Object.entries(manifest.datasets).map(([name, e]) => (
              <div key={name} className="flex items-center justify-between gap-2 border-b border-border p-3 last:border-b-0">
                <span>
                  <span className="font-medium">{name}</span> · {e.count} แถว · {(e.bytes / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className={`${btn} h-9 border border-border bg-bg-raised px-3 text-xs hover:border-text-faint`}
                  onClick={() => {
                    if (window.confirm(`ปิด ${name}? เว็บจะกลับไปอ่านจาก Supabase`)) void run({ action: "disable", dataset: name }, `ปิด ${name} แล้ว`);
                  }}
                >
                  ปิด
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy} onClick={() => void run({ action: "publish", datasets: DATASETS }, "เผยแพร่แล้ว")} className={`${btn} bg-accent text-accent-fg hover:brightness-110`}>
          <UploadCloud className="h-4 w-4" /> {busy ? "กำลังทำงาน..." : "เผยแพร่ heroes + hero-text"}
        </button>
        <button type="button" disabled={busy} onClick={() => void refresh()} className={`${btn} border border-border bg-bg-raised hover:border-text-faint`}>
          <RefreshCw className="h-4 w-4" /> รีเฟรชสถานะ
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="block h-11 w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:w-56 sm:text-sm"
          inputMode="numeric"
          placeholder="ย้อนกลับไป generation ที่..."
          value={rollbackTo}
          onChange={(e) => setRollbackTo(e.target.value.replace(/\D/g, ""))}
          aria-label="Generation ที่จะย้อนกลับไป"
        />
        <button
          type="button"
          disabled={busy || !rollbackTo}
          onClick={() => {
            if (window.confirm(`ย้อนกลับไป generation ${rollbackTo}?`)) void run({ action: "rollback", generation: Number(rollbackTo) }, `ย้อนกลับไป generation ${rollbackTo} แล้ว`);
          }}
          className={`${btn} border border-border bg-bg-raised hover:border-text-faint`}
        >
          ย้อนกลับ
        </button>
      </div>
    </section>
  );
}
