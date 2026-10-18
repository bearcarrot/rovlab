/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Download, FileUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { epAge, epExpired, epTail, parseEpText, type StoredEp } from "@/lib/epList";

// client แบบ untyped เพราะเรียก Edge Function ที่ไม่มี generated types
const db: any = supabase;

type Mode = "paste" | "file" | "url";
type Meta = { via: string; status: number; ms: number };
type UrlEp = { index: number; label: string; at: number | null; tail: string };
type RankKey = "all" | "high";

const KEY_PASTE = "rov_encode_param"; // ชื่อคีย์เดียวกับตัวดึงเดิม index.php
const KEY_LIST = "rov_ep_list";
const KEY_IDX = "rov_ep_idx";
const KEY_USED = "rov_ep_used"; // { ท้ายค่า EP: เวลาที่ใช้ล่าสุด }

const ctl =
  "block w-full rounded-lg border border-border bg-bg-raised px-3 py-2 font-mono text-base text-text outline-none transition " +
  "focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const card = "space-y-3 rounded-card border border-border bg-bg-surface p-4 shadow-card";

function lsGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function lsSet(key: string, value: string) {
  try {
    if (value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // localStorage ถูกปิด — ใช้ต่อได้แต่ไม่จำค่า
  }
}
function lsJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(lsGet(key)) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

// supabase-js ซ่อนข้อความจริงของ Edge Function ไว้ใน error.context (Response)
async function fnError(error: any): Promise<{ error: string; meta: Meta | null }> {
  try {
    const j = await error.context.json();
    return { error: j.error ?? error.message, meta: j.meta ?? null };
  } catch {
    return { error: error.message, meta: null };
  }
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export function GameFetchCard({
  kind,
  onFetched,
}: {
  kind: "rank" | "adjust";
  /** ส่ง JSON ดิบของเกมเป็นข้อความ เข้าตัว parse เดิมของหน้า (key = แรงก์ที่เลือกเมื่อ kind เป็น rank) */
  onFetched: (jsonText: string, key?: RankKey) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("paste");
  const [rankKey, setRankKey] = useState<RankKey>("high");
  const [paste, setPaste] = useState("");
  const [list, setList] = useState<StoredEp[]>([]);
  const [idx, setIdx] = useState(0);
  const [urlList, setUrlList] = useState<UrlEp[] | null>(null);
  const [urlIdx, setUrlIdx] = useState(0);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setPaste(lsGet(KEY_PASTE));
    const saved = lsJson<StoredEp[]>(KEY_LIST, []);
    setList(Array.isArray(saved) ? saved : []);
    const i = parseInt(lsGet(KEY_IDX) || "0", 10);
    setIdx(Number.isInteger(i) && i >= 0 ? i : 0);
    setUsed(lsJson<Record<string, number>>(KEY_USED, {}));
  }, []);

  const fileEp = list[idx] ?? (list.length ? list[0] : undefined);
  const urlEp = urlList?.[urlIdx];

  function move(step: number) {
    if (mode === "file" && list.length) {
      const n = (idx + step + list.length) % list.length;
      setIdx(n);
      lsSet(KEY_IDX, String(n));
    } else if (mode === "url" && urlList?.length) {
      setUrlIdx((urlIdx + step + urlList.length) % urlList.length);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const items = parseEpText(await f.text());
      setList(items);
      setIdx(0);
      lsSet(KEY_LIST, JSON.stringify(items));
      lsSet(KEY_IDX, "0");
      toast.success(`โหลด ${items.length} EP แล้ว (เก็บในเบราว์เซอร์นี้เท่านั้น)`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function loadUrlList() {
    setBusy(true);
    setErr("");
    const { data, error } = await db.functions.invoke("game-fetch", { body: { action: "list_eps" } });
    setBusy(false);
    if (error) {
      const e = await fnError(error);
      setErr(e.error);
      toast.error(`โหลดรายการจาก URL ไม่สำเร็จ: ${e.error}`);
      return;
    }
    setUrlList(data.items as UrlEp[]);
    setUrlIdx(0);
  }

  function markUsed(tail: string) {
    const next = { ...used, [tail]: Date.now() };
    setUsed(next);
    lsSet(KEY_USED, JSON.stringify(next));
  }

  async function run() {
    const body: Record<string, unknown> = { kind };
    if (kind === "rank") body.rank_key = rankKey;
    let tail = "";
    if (mode === "paste") {
      if (!paste.trim()) {
        toast.error("วาง Encodeparam ก่อน");
        return;
      }
      body.ep = paste.trim();
      tail = epTail(paste);
    } else if (mode === "file") {
      if (!fileEp) {
        toast.error("ยังไม่ได้โหลดไฟล์ ep.json");
        return;
      }
      body.ep = fileEp.value;
      tail = epTail(fileEp.value);
    } else {
      if (!urlEp) {
        toast.error("โหลดรายการ EP จาก URL ก่อน");
        return;
      }
      body.ep_index = urlEp.index;
      tail = urlEp.tail;
    }
    setBusy(true);
    setErr("");
    setMeta(null);
    markUsed(tail);
    const { data, error } = await db.functions.invoke("game-fetch", { body });
    setBusy(false);
    if (error) {
      const e = await fnError(error);
      setErr(e.error);
      setMeta(e.meta);
      toast.error(`ดึงไม่สำเร็จ: ${e.error}`);
      return;
    }
    setMeta(data.meta ?? null);
    onFetched(JSON.stringify(data.data), kind === "rank" ? rankKey : undefined);
    toast.success("ดึงจากเกมแล้ว ตรวจพรีวิวด้านล่างก่อนนำเข้า");
  }

  // ข้อมูลของ EP ที่เลือกอยู่ (โหมดไฟล์/URL) สำหรับแถวตัวสลับ
  const cur =
    mode === "file" && fileEp
      ? { label: `${list.indexOf(fileEp) + 1}/${list.length} · ${fileEp.label}`, tail: epTail(fileEp.value), at: fileEp.at, est: fileEp.est }
      : mode === "url" && urlEp && urlList
        ? { label: `${urlIdx + 1}/${urlList.length} · ${urlEp.label}`, tail: urlEp.tail, at: urlEp.at ?? 0, est: urlEp.at == null }
        : null;
  const lastUsed = cur ? used[cur.tail] : undefined;

  return (
    <section className={card}>
      <h2 className="font-display text-base font-semibold">ดึงจากเกมโดยตรง (ทางเลือก)</h2>
      <p className="text-xs text-text-muted">
        เซิร์ฟเวอร์เป็นคนยิงไปหาเกมให้ ผลที่ได้เข้าขั้นตอนพรีวิว/ยืนยันเดียวกับการเลือกไฟล์ · Encodeparam ส่งเป็น header เท่านั้น ไม่ถูกเก็บฝั่งเซิร์ฟเวอร์
      </p>

      {kind === "rank" && (
        <div className="grid grid-cols-2 gap-2">
          {([
            ["high", "แรงก์สูง (high)"],
            ["all", "ทุกแรงก์ (all)"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={rankKey === k}
              onClick={() => setRankKey(k)}
              className={`h-11 rounded-lg border px-3 text-sm transition ${
                rankKey === k ? "border-accent bg-accent/15 font-medium text-accent" : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {([
          ["paste", "วางเอง"],
          ["file", "ไฟล์ ep.json"],
          ["url", "จาก URL"],
        ] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`h-11 rounded-lg border px-2 text-sm transition ${
              mode === m ? "border-accent bg-accent/15 font-medium text-accent" : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "paste" && (
        <div>
          <label htmlFor="gf-ep" className="mb-1.5 block text-xs font-medium text-text-muted">
            Encodeparam (จำไว้ในเบราว์เซอร์นี้)
          </label>
          <textarea
            id="gf-ep"
            rows={3}
            spellCheck={false}
            className={ctl}
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              lsSet(KEY_PASTE, e.target.value.trim());
            }}
            placeholder="วาง Encodeparam ที่นี่"
          />
        </div>
      )}

      {mode === "file" && (
        <label className={`${btn} w-full cursor-pointer border border-border bg-bg-raised text-text hover:border-text-faint sm:w-auto`}>
          <FileUp className="h-4 w-4" /> {list.length ? `โหลด ep.json ใหม่ (มี ${list.length} ค่า)` : "เลือกไฟล์ ep.json"}
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      )}

      {mode === "url" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadUrlList()}
          className={`${btn} w-full border border-border bg-bg-raised hover:border-text-faint sm:w-auto`}
        >
          {urlList ? `โหลดรายการใหม่ (มี ${urlList.length} ค่า)` : "โหลดรายการ EP จาก URL"}
        </button>
      )}

      {cur && (
        <div className="flex items-center gap-2">
          <button type="button" aria-label="ก่อนหน้า" onClick={() => move(-1)} className={`${btn} w-12 border border-border bg-bg-raised px-0`}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <b className="block truncate text-sm">
              {cur.label} <span className="font-mono text-xs font-normal text-text-muted">…{cur.tail}</span>
            </b>
            <span className="block text-xs text-text-muted">
              {lastUsed ? `ใช้ล่าสุด ${hhmm(lastUsed)} (${epAge(lastUsed)}ที่แล้ว)` : "ยังไม่เคยใช้"}
              {cur.at ? ` · อายุ ${epAge(cur.at)}${cur.est ? " (นับจากเวลาที่นำเข้า)" : ""}` : ""}
            </span>
            {cur.at > 0 && epExpired(cur.at) && <span className="block text-xs text-loss">เกิน 24 ชม. แล้ว อาจหมดอายุ</span>}
          </div>
          <button type="button" aria-label="ถัดไป" onClick={() => move(1)} className={`${btn} w-12 border border-border bg-bg-raised px-0`}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <button type="button" disabled={busy} onClick={() => void run()} className={`${btn} w-full bg-accent text-accent-fg hover:brightness-110 sm:w-auto`}>
        <Download className="h-4 w-4" /> {busy ? "กำลังดึง..." : kind === "rank" ? `ดึงสถิติแรงก์ ${rankKey}` : "ดึงประวัติปรับบาลานซ์"}
      </button>

      {meta && (
        <p className="text-xs text-text-muted">
          ผ่าน {meta.via} · เกมตอบ HTTP {meta.status} · {meta.ms} ms
        </p>
      )}
      {err && (
        <p className="flex items-start gap-1.5 text-xs text-loss">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{err}</span>
        </p>
      )}
    </section>
  );
}
