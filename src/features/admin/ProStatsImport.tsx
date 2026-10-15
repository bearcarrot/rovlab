/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { AlertCircle, Check, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getLatestPatch } from "@/services/meta";
import { useToast } from "@/components/ui/toast";

// client แบบ untyped เพราะเรียก RPC / Edge Function ที่ไม่มี generated types
const db: any = supabase;

const DEFAULT_URL = "https://liquipedia.net/honorofkings/RoV_Pro_League/2026/Winter/Statistics";

type ProRow = { name: string; picks: number; win_rate: number; pick_rate: number; ban_rate: number; sigma: number; tier: string };
type Result = { stats: number; unmatched: string[]; patch: string };

const ctl =
  "block h-11 w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition " +
  "focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const card = "space-y-3 rounded-card border border-border bg-bg-surface p-4 shadow-card";

// supabase-js ซ่อนข้อความจริงของ Edge Function ไว้ใน error.context (Response)
async function fnError(error: any): Promise<string> {
  try {
    return (await error.context.json()).error ?? error.message;
  } catch {
    return error.message;
  }
}

export function ProStatsImport() {
  const toast = useToast();
  const [url, setUrl] = useState(DEFAULT_URL);
  const [rows, setRows] = useState<ProRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function fetchRows() {
    setBusy(true);
    setResult(null);
    setRows(null);
    const { data, error } = await db.functions.invoke("pro-stats", { body: { url: url.trim() } });
    setBusy(false);
    if (error) toast.error(`ดึงข้อมูลไม่สำเร็จ: ${await fnError(error)}`);
    else setRows(data.rows as ProRow[]);
  }

  async function save() {
    if (!rows) return;
    setBusy(true);
    // ฝั่งเว็บอ่านสถิติจากแพตช์ล่าสุดเท่านั้น จึงบันทึกลงแพตช์ล่าสุดเสมอ
    const patch = await getLatestPatch();
    if (!patch) {
      setBusy(false);
      toast.error("ไม่พบแพตช์ล่าสุด");
      return;
    }
    const { data, error } = await db.rpc("admin_import_pro_stats", { p_patch: patch.id, p_rows: rows });
    setBusy(false);
    if (error) toast.error(`บันทึกไม่สำเร็จ: ${error.message}`);
    else {
      setResult({ ...(data as Omit<Result, "patch">), patch: patch.code });
      toast.success("บันทึกสถิติ Pro แล้ว");
    }
  }

  return (
    <section className={card}>
      <h2 className="font-display text-base font-semibold">นำเข้าสถิติ Pro จาก Liquipedia</h2>
      <p className="text-xs text-text-muted">
        ดึงตาราง Hero Statistics ของ RoV Pro League · Tier ตัดจาก ∑ (Picks + Bans) เทียบฮีโร่ที่ ∑ สูงสุด: ≥80% = S+ · ≥60% = S · ≥40% = A ·
        ≥20% = B · ต่ำกว่า = C · ข้อมูลจาก Liquipedia (CC-BY-SA 3.0) · Liquipedia จำกัดการดึง 1 ครั้งต่อ 30 วินาที
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={ctl} value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" aria-label="URL หน้า Statistics" />
        <button type="button" disabled={busy || !url.trim()} onClick={() => void fetchRows()} className={`${btn} border border-border bg-bg-raised hover:border-text-faint`}>
          <Download className="h-4 w-4" /> {busy && !rows ? "กำลังดึง..." : "ดึงข้อมูล"}
        </button>
      </div>

      {rows && (
        <>
          <p className="flex items-start gap-1.5 text-sm text-win">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              อ่านได้ {rows.length} ฮีโร่ · ∑ สูงสุด {rows[0]?.sigma} ({rows[0]?.name})
            </span>
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-bg-raised text-text-muted">
                <tr>
                  <th className="px-2 py-1.5">ฮีโร่</th>
                  <th className="px-2 py-1.5 text-right">∑</th>
                  <th className="px-2 py-1.5 text-right">Pick</th>
                  <th className="px-2 py-1.5 text-right">Win%</th>
                  <th className="px-2 py-1.5 text-right">Tier</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-border">
                    <td className="px-2 py-1.5">{r.name}</td>
                    <td className="px-2 py-1.5 text-right">{r.sigma}</td>
                    <td className="px-2 py-1.5 text-right">{r.picks}</td>
                    <td className="px-2 py-1.5 text-right">{r.win_rate}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{r.tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} w-full bg-accent text-accent-fg hover:brightness-110 sm:w-auto`}>
            {busy ? "กำลังบันทึก..." : "บันทึกลงแพตช์ล่าสุด (แรงก์ pro)"}
          </button>
        </>
      )}

      {result && (
        <div className="space-y-1 rounded-lg border border-win/40 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-win">
            <Check className="h-4 w-4" /> บันทึก {result.stats} ฮีโร่ (แพตช์ {result.patch} · แรงก์ pro)
          </p>
          {result.unmatched.length > 0 && (
            <p className="flex items-start gap-1.5 text-loss">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>ข้าม {result.unmatched.length} ชื่อที่ไม่ตรงกับฮีโร่ในฐานข้อมูล: {result.unmatched.join(", ")}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
