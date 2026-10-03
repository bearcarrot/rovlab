/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, FileUp, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BalanceIcon } from "@/features/balance/BalanceIcon";
import { BALANCE_LABEL, type BalanceKind } from "@/services/balance";

const db: any = supabase;

type Row = {
  id: number; // heroId ในไฟล์ = heroes.hero_id
  name: string;
  kind: BalanceKind;
  tag: string;
  reason: string;
  skills: { slot: string; name: string; content: string }[];
  changed_at: string; // YYYY-MM-DD
};
type Patch = { id: string; code: string };
type Saved = { id: string; kind: BalanceKind; changed_at: string; heroes: { name: string; name_th: string | null } | null };

// ไฟล์จากตัวดัก request มักมีหัว "POST https://... 200 / Request Headers ..." นำหน้า JSON — รองรับทั้ง JSON ล้วนและแบบมีหัว
function extractJson(text: string): any {
  const t = text.replace(/^\uFEFF/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    /* ไฟล์มีหัวนำหน้า */
  }
  const lines = t.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l.startsWith("{") && l.includes("heroAdjustList")) {
      try {
        return JSON.parse(l);
      } catch {
        /* ลองบรรทัดก่อนหน้า */
      }
    }
  }
  const start = t.indexOf('{"code"');
  if (start >= 0) {
    try {
      return JSON.parse(t.slice(start));
    } catch {
      /* ไม่ใช่ JSON ที่อ่านได้ */
    }
  }
  throw new Error("ไม่พบข้อมูล JSON ในไฟล์");
}

// ดูจากป้ายข้อความก่อน (แม่นกว่า เพราะบางรายการไม่มี adjustType ที่ตรงกัน) ค่อยใช้ adjustType: 1 บัฟ, 2 เนิฟ, 4 รีเวิร์ก
function kindOf(e: any): BalanceKind {
  const tag = String(e?.heroChangeTag ?? "").toLowerCase();
  if (tag.includes("nerf")) return "nerf";
  if (tag.includes("buff")) return "buff";
  if (tag.includes("rework") || tag.includes("อัปเกรด")) return "rework";
  switch (Number(e?.adjustType)) {
    case 1:
      return "buff";
    case 2:
      return "nerf";
    case 4:
      return "rework";
    default:
      return "adjust";
  }
}

function parseAdjustList(text: string): Row[] {
  const json = extractJson(text);
  const list = json?.data?.heroAdjustList;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("ไม่พบ heroAdjustList ในไฟล์ (ต้องเป็นผลลัพธ์ของ getlatestadjustlist)");
  }
  const rows: Row[] = list.map((e: any) => {
    const ts = Number(e?.updateTime);
    const d = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : null;
    return {
      id: Number(e?.heroId),
      name: String(e?.heroName ?? ""),
      kind: kindOf(e),
      tag: String(e?.heroChangeTag ?? ""),
      reason: String(e?.deviseIdeas ?? ""),
      skills: (Array.isArray(e?.skillChanges) ? e.skillChanges : [])
        .slice()
        .sort((a: any, b: any) => (Number(a?.showPriority) || 0) - (Number(b?.showPriority) || 0))
        .map((s: any) => ({ slot: String(s?.skillSlot ?? ""), name: String(s?.skillName ?? ""), content: String(s?.changeContent ?? "") })),
      changed_at: d ? d.toISOString().slice(0, 10) : "",
    };
  });
  const bad = rows.find((r) => !Number.isInteger(r.id) || !/^\d{4}-\d{2}-\d{2}$/.test(r.changed_at));
  if (bad) throw new Error(`ข้อมูลของฮีโร่ไม่สมบูรณ์หรือผิดรูปแบบ: ${bad.name || bad.id}`);
  if (new Set(rows.map((r) => `${r.id}|${r.changed_at}`)).size !== rows.length) {
    throw new Error("พบฮีโร่ซ้ำวันที่เดียวกันในไฟล์");
  }
  return rows;
}

const fmt = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

const ctl =
  "block h-11 w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition " +
  "focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const card = "space-y-3 rounded-card border border-border bg-bg-surface p-4 shadow-card";
const KINDS: BalanceKind[] = ["buff", "nerf", "adjust", "rework"];

export function AdminImportBalance() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [patches, setPatches] = useState<Patch[]>([]);
  const [patchId, setPatchId] = useState("");
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ saved: number; unmatched: { id: number; name: string }[] } | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [delId, setDelId] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    const { data } = await db
      .from("hero_balance_changes")
      .select("id, kind, changed_at, heroes(name, name_th)")
      .order("changed_at", { ascending: false })
      .limit(60);
    setSaved((data ?? []) as Saved[]);
  }, []);

  useEffect(() => {
    void loadSaved();
    db.from("heroes")
      .select("hero_id")
      .then(({ data }: { data: { hero_id: number | null }[] | null }) =>
        setKnown(new Set((data ?? []).map((h) => h.hero_id).filter((x): x is number => x != null)))
      );
    db.from("patches")
      .select("id, code")
      .order("released_at", { ascending: false })
      .then(({ data }: { data: Patch[] | null }) => {
        setPatches(data ?? []);
        setPatchId(data?.[0]?.id ?? "");
      });
  }, [loadSaved]);

  async function onFile(f: File | undefined) {
    setResult(null);
    setConfirming(false);
    setError("");
    setRows(null);
    if (!f) return;
    setFileName(f.name);
    try {
      setRows(parseAdjustList(await f.text()));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runImport() {
    if (!rows) return;
    setBusy(true);
    setError("");
    const { data, error: e } = await db.rpc("admin_import_balance_changes", { p_patch: patchId || null, p_rows: rows });
    setBusy(false);
    setConfirming(false);
    if (e) setError(e.message);
    else {
      setResult(data);
      void loadSaved();
    }
  }

  async function setKind(id: string, kind: BalanceKind) {
    const { error: e } = await db.from("hero_balance_changes").update({ kind }).eq("id", id);
    if (e) setError(e.message);
    else setSaved((s) => s.map((x) => (x.id === id ? { ...x, kind } : x)));
  }

  async function remove(id: string) {
    const { error: e } = await db.from("hero_balance_changes").delete().eq("id", id);
    setDelId(null);
    if (e) setError(e.message);
    else setSaved((s) => s.filter((x) => x.id !== id));
  }

  const matched = rows ? rows.filter((r) => known.has(r.id)).length : 0;
  const patchCode = patches.find((p) => p.id === patchId)?.code;

  return (
    <div className="space-y-4 pb-24">
      <section className={card}>
        <h2 className="font-display text-base font-semibold">1. เลือกไฟล์ getlatestadjustlist.json</h2>
        <p className="text-xs text-text-muted">อ่านไฟล์บนเครื่องคุณเท่านั้น ส่งขึ้นฐานข้อมูลเฉพาะรายการปรับสมดุล (หัวไฟล์/header ที่ติดมาจะถูกข้าม)</p>
        <label className={`${btn} w-full cursor-pointer border border-border bg-bg-raised text-text hover:border-text-faint sm:w-auto`}>
          <FileUp className="h-4 w-4" /> {fileName || "เลือกไฟล์"}
          <input type="file" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      </section>

      {rows && (
        <section className={card}>
          <h2 className="font-display text-base font-semibold">2. ตรวจทานก่อนนำเข้า ({rows.length} รายการ)</h2>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={`${r.id}|${r.changed_at}`} className="flex items-start gap-3 rounded-lg border border-border bg-bg-raised p-3">
                <span className="mt-0.5">
                  <BalanceIcon kind={r.kind} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {r.name} <span className="text-text-muted">· {BALANCE_LABEL[r.kind]}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {fmt(r.changed_at)} · {r.skills.length} รายการสกิล · ป้ายจากเกม "{r.tag}"
                  </p>
                  {!known.has(r.id) && <p className="mt-1 text-xs text-loss">ไม่พบฮีโร่นี้ในฐานข้อมูล (hero_id {r.id}) — จะถูกข้าม</p>}
                </div>
              </li>
            ))}
          </ul>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">ผูกกับแพตช์ (ไม่บังคับ — ไฟล์ไม่มีเลขแพตช์ มีแค่วันที่)</span>
            <select className={ctl} value={patchId} onChange={(e) => setPatchId(e.target.value)}>
              <option value="">ไม่ผูกแพตช์</option>
              {patches.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </div>

          {!confirming ? (
            <button
              type="button"
              disabled={busy || matched === 0}
              onClick={() => setConfirming(true)}
              className={`${btn} w-full bg-accent text-accent-fg hover:brightness-110 sm:w-auto`}
            >
              นำเข้า {matched} รายการ
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-accent/40 bg-bg-raised p-3">
              <p className="text-sm">
                บันทึก {matched} รายการ{patchCode ? ` ผูกกับแพตช์ ${patchCode}` : ""} รายการที่มีอยู่แล้ว (ฮีโร่ + วันที่เดียวกัน) จะถูกอัปเดต ยืนยันหรือไม่?
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirming(false)} className={`${btn} border border-border bg-bg-surface hover:border-text-faint`}>
                  ยกเลิก
                </button>
                <button type="button" disabled={busy} onClick={() => void runImport()} className={`${btn} bg-accent text-accent-fg hover:brightness-110`}>
                  {busy ? "กำลังนำเข้า..." : "ยืนยันนำเข้า"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {result && (
        <section className={`${card} border-win/40`}>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-win">
            <Check className="h-4 w-4" /> นำเข้าเรียบร้อยแล้ว
          </h2>
          <p className="text-sm">บันทึก {result.saved} รายการ</p>
          {result.unmatched.length > 0 && (
            <p className="text-sm text-loss">ข้ามที่ไม่มีในฐานข้อมูล: {result.unmatched.map((u) => u.name).join(", ")}</p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-loss">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      <section className={card}>
        <h2 className="font-display text-base font-semibold">รายการที่บันทึกไว้ ({saved.length})</h2>
        <p className="text-xs text-text-muted">แก้ประเภท (บัฟ/เนิฟ/ปรับสมดุล/รีเวิร์ก) หรือลบได้ที่นี่ ไอคอนบนการ์ดฮีโร่แสดงเฉพาะการปรับที่ไม่เกิน 60 วัน</p>
        {saved.length === 0 && <p className="text-sm text-text-muted">ยังไม่มีรายการ</p>}
        <ul className="space-y-2">
          {saved.map((s) => (
            <li key={s.id} className="space-y-2 rounded-lg border border-border bg-bg-raised p-3">
              <div className="flex items-center gap-2">
                <BalanceIcon kind={s.kind} className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.heroes?.name || s.heroes?.name_th || "?"}</span>
                <span className="text-xs text-text-muted">{fmt(s.changed_at)}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select className={ctl} value={s.kind} onChange={(e) => void setKind(s.id, e.target.value as BalanceKind)}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {BALANCE_LABEL[k]}
                    </option>
                  ))}
                </select>
                {delId === s.id ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDelId(null)} className={`${btn} border border-border bg-bg-surface`}>ยกเลิก</button>
                    <button type="button" onClick={() => void remove(s.id)} className={`${btn} bg-loss text-white hover:brightness-110`}>ยืนยันลบ</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setDelId(s.id)} className={`${btn} border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20`}>
                    <Trash2 className="h-4 w-4" /> ลบ
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
