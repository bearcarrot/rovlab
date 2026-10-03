/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, FileUp, Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// client แบบ untyped เพราะเรียก RPC / ตารางที่ไม่มี generated types
const db: any = supabase;

type ImportRow = {
  id: number; // hero.id ในไฟล์ = heroes.hero_id
  name: string;
  win_rate: number; // %
  pick_rate: number; // %
  ban_rate: number; // %
  matches: number; // heroPickCnt
  w1: number | null; // id ของฮีโร่ที่ชนะทางอันดับ 1-3 (winrate1Hero..3Hero)
  w2: number | null;
  w3: number | null;
};
type DbHero = { id: string; name: string; name_th: string | null; hero_id: number | null };
type Patch = { id: string; code: string };
type Result = { stats: number; counters: number; unmatched: { id: number; name: string }[] };

// ไฟล์ที่เซฟจากตัวดัก request มักมีหัว "POST https://... 200 / Request Headers ..." นำหน้า JSON ผลลัพธ์
// รองรับทั้ง JSON ล้วน ๆ และไฟล์แบบมีหัว — อ่านบนเบราว์เซอร์เท่านั้น ส่งขึ้น DB เฉพาะตัวเลขสถิติ
function extractJson(text: string): any {
  const t = text.replace(/^\uFEFF/, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    /* ไฟล์มีหัวนำหน้า ลองหาก้อน JSON */
  }
  const lines = t.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l.startsWith("{") && l.includes("heroList")) {
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

const pct = (x: unknown) => Math.round(Number(x) * 10000) / 100; // 0.5222 -> 52.22
const optId = (h: any) => (h?.id != null && h.id !== "" ? Number(h.id) : null);

function parseRankList(text: string): { rows: ImportRow[]; updated: Date | null } {
  const json = extractJson(text);
  const list = json?.data?.heroList;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("ไม่พบ heroList ในไฟล์ (ต้องเป็นผลลัพธ์ของ getranklist)");
  }
  const rows: ImportRow[] = list.map((e: any) => ({
    id: Number(e?.hero?.id),
    name: String(e?.hero?.name ?? ""),
    win_rate: pct(e?.heroWinRate),
    pick_rate: pct(e?.heroPickRate),
    ban_rate: pct(e?.heroBanRate),
    matches: Number(e?.heroPickCnt) || 0,
    w1: optId(e?.winrate1Hero),
    w2: optId(e?.winrate2Hero),
    w3: optId(e?.winrate3Hero),
  }));
  const bad = rows.find(
    (r) =>
      !Number.isInteger(r.id) ||
      ![r.win_rate, r.pick_rate, r.ban_rate].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
  );
  if (bad) throw new Error(`ข้อมูลของฮีโร่ไม่สมบูรณ์หรือผิดรูปแบบ: ${bad.name || bad.id}`);
  if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error("พบ hero.id ซ้ำกันในไฟล์");
  const ts = Number(json?.data?.lastUpdateDate);
  return { rows, updated: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : null };
}

const ctl =
  "block h-11 w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition " +
  "focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium " +
  "transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const card = "space-y-3 rounded-card border border-border bg-bg-surface p-4 shadow-card";

export function AdminImport() {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<{ rows: ImportRow[]; updated: Date | null } | null>(null);
  const [error, setError] = useState("");
  const [patches, setPatches] = useState<Patch[]>([]);
  const [patchId, setPatchId] = useState("");
  const [rank, setRank] = useState<"high" | "all">("high");
  const [counters, setCounters] = useState(false);
  const [heroes, setHeroes] = useState<DbHero[]>([]);
  const [linkSel, setLinkSel] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const loadHeroes = useCallback(async () => {
    const { data } = await db.from("heroes").select("id,name,name_th,hero_id").order("name");
    setHeroes((data ?? []) as DbHero[]);
  }, []);

  useEffect(() => {
    void loadHeroes();
    db.from("patches")
      .select("id,code")
      .order("released_at", { ascending: false })
      .then(({ data }: { data: Patch[] | null }) => {
        setPatches(data ?? []);
        setPatchId(data?.[0]?.id ?? "");
      });
  }, [loadHeroes]);

  async function onFile(f: File | undefined) {
    setResult(null);
    setConfirming(false);
    setError("");
    setParsed(null);
    if (!f) return;
    setFileName(f.name);
    try {
      setParsed(parseRankList(await f.text()));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const known = new Set(heroes.map((h) => h.hero_id).filter((x): x is number => x != null));
  const unmatched = parsed ? parsed.rows.filter((r) => !known.has(r.id)) : [];
  const freeHeroes = heroes.filter((h) => h.hero_id == null);
  const patchCode = patches.find((p) => p.id === patchId)?.code ?? "?";

  async function link(r: ImportRow) {
    const uuid = linkSel[r.id];
    if (!uuid) return;
    const { error: e } = await db.from("heroes").update({ hero_id: r.id }).eq("id", uuid);
    if (e) setError(e.message);
    else {
      setError("");
      await loadHeroes();
    }
  }

  async function runImport() {
    if (!parsed || !patchId) return;
    setBusy(true);
    setError("");
    const { data, error: e } = await db.rpc("admin_import_rank_list", {
      p_patch: patchId,
      p_rank: rank,
      p_rows: parsed.rows,
      p_counters: counters,
    });
    setBusy(false);
    setConfirming(false);
    if (e) setError(e.message);
    else setResult(data as Result);
  }

  return (
    <div className="space-y-4 pb-24">
      <section className={card}>
        <h2 className="font-display text-base font-semibold">1. เลือกไฟล์ getranklist.json</h2>
        <p className="text-xs text-text-muted">
          อ่านไฟล์บนเครื่องคุณเท่านั้น ส่งขึ้นฐานข้อมูลเฉพาะตัวเลขสถิติ (หัวไฟล์/header ที่ติดมาจะถูกข้าม)
        </p>
        <label className={`${btn} w-full cursor-pointer border border-border bg-bg-raised text-text hover:border-text-faint sm:w-auto`}>
          <FileUp className="h-4 w-4" /> {fileName || "เลือกไฟล์"}
          <input type="file" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {parsed && (
          <p className="flex items-start gap-1.5 text-sm text-win">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            อ่านได้ {parsed.rows.length} ฮีโร่
            {parsed.updated && ` · เกมอัปเดตล่าสุด ${parsed.updated.toLocaleDateString("th-TH", { dateStyle: "medium" })}`}
          </p>
        )}
      </section>

      {parsed && unmatched.length > 0 && (
        <section className={`${card} border-loss/40`}>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-loss">
            <AlertCircle className="h-4 w-4" /> ยังจับคู่ไม่ได้ {unmatched.length} ตัว
          </h2>
          <p className="text-xs text-text-muted">
            ไม่มีฮีโร่ที่ใช้ hero_id นี้ในฐานข้อมูล ถ้าเป็นฮีโร่ที่มีอยู่แล้วให้ผูกด้านล่าง ถ้าเป็นฮีโร่ใหม่ ไปเพิ่มในแท็บฮีโร่ก่อน แล้วกลับมาผูก (ถ้าไม่ผูก ตัวนี้จะถูกข้ามตอนนำเข้า)
          </p>
          <ul className="space-y-3">
            {unmatched.map((r) => (
              <li key={r.id} className="space-y-2 rounded-lg border border-border bg-bg-raised p-3">
                <p className="text-sm font-medium">
                  {r.name} <span className="text-text-muted">· hero_id {r.id}</span>
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className={ctl}
                    value={linkSel[r.id] ?? ""}
                    onChange={(e) => setLinkSel((s) => ({ ...s, [r.id]: e.target.value }))}
                  >
                    <option value="">— เลือกฮีโร่ในฐานข้อมูล —</option>
                    {freeHeroes.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name || h.name_th}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!linkSel[r.id]}
                    onClick={() => void link(r)}
                    className={`${btn} border border-border bg-bg-surface hover:border-text-faint`}
                  >
                    <Link2 className="h-4 w-4" /> ผูก
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsed && (
        <section className={card}>
          <h2 className="font-display text-base font-semibold">2. ตั้งค่าการนำเข้า</h2>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">แพตช์ที่จะบันทึกสถิติลง</span>
            <select className={ctl} value={patchId} onChange={(e) => setPatchId(e.target.value)}>
              {patches.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-text-muted">ไฟล์นี้เป็นสถิติของแรงก์ไหน</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["high", "แรงก์สูง (high)"],
                ["all", "ทุกแรงก์ (all)"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={rank === k}
                  onClick={() => setRank(k)}
                  className={`h-11 rounded-lg border px-3 text-sm transition ${
                    rank === k
                      ? "border-accent bg-accent/15 font-medium text-accent"
                      : "border-border bg-bg-raised text-text-muted hover:border-text-faint"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg-raised p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent,#3b82f6)]"
              checked={counters}
              onChange={(e) => setCounters(e.target.checked)}
            />
            <span className="text-sm">
              อัปเดตเคาน์เตอร์จากอันดับชนะทาง 1-3 ในไฟล์ด้วย
              <span className="mt-0.5 block text-xs text-text-muted">
                แทนที่เฉพาะแถวที่ระบบสร้างจากสถิติ ("ชนะทางอันดับ N ตามสถิติแรงก์จริง") แถวที่คุณเขียนเองจะไม่ถูกแตะ
              </span>
            </span>
          </label>

          <p className="text-xs text-text-muted">
            Tier คำนวณจาก Win Rate: S+ ≥ 52 · S ≥ 50.5 · A ≥ 49 · B ≥ 47.5 · น้อยกว่านั้น = C
          </p>

          {!confirming ? (
            <button
              type="button"
              disabled={!patchId || busy}
              onClick={() => setConfirming(true)}
              className={`${btn} w-full bg-accent text-accent-fg hover:brightness-110 sm:w-auto`}
            >
              นำเข้าข้อมูล
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-accent/40 bg-bg-raised p-3">
              <p className="text-sm">
                จะทับสถิติของ {parsed.rows.length - unmatched.length} ฮีโร่ ในแพตช์ <b>{patchCode}</b> · แรงก์ <b>{rank}</b>
                {counters && " และอัปเดตเคาน์เตอร์จากสถิติ"}
                {unmatched.length > 0 && ` (ข้าม ${unmatched.length} ตัวที่ยังจับคู่ไม่ได้)`}
                ยืนยันหรือไม่?
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={`${btn} border border-border bg-bg-surface hover:border-text-faint`}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runImport()}
                  className={`${btn} bg-accent text-accent-fg hover:brightness-110`}
                >
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
          <ul className="space-y-1 text-sm">
            <li>อัปเดตสถิติ {result.stats} ฮีโร่ (แพตช์ {patchCode} · แรงก์ {rank})</li>
            {counters && <li>สร้างเคาน์เตอร์จากสถิติ {result.counters} แถว</li>}
            {result.unmatched.length > 0 && (
              <li className="text-loss">
                ข้าม {result.unmatched.length} ตัวที่ไม่มีในฐานข้อมูล: {result.unmatched.map((u) => u.name).join(", ")}
              </li>
            )}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-loss">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}
    </div>
  );
}
