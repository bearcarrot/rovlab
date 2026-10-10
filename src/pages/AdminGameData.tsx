/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { usePersistedState } from "@/hooks/usePersistedState";
import {
  ENCH_CATEGORIES, ITEM_TYPES, RUNE_COLORS, STATUSES, TABLE, VERIFY_LABEL,
  explainDbError, toForm, toPayload, validate, verifyState,
  type CatalogKind, type Form, type VerifyState,
} from "@/lib/catalogAdmin";

// ใช้ client แบบ untyped เหมือน Admin.tsx เพราะตารางถูกกำหนดแบบ config
const db: any = supabase;
type Row = Record<string, any>;
const PAGE = 20;
const BUCKET = "hero-icons";

const KINDS: [CatalogKind, string][] = [
  ["items", "ไอเทม"],
  ["rune", "รูน"],
  ["spells", "สกิลชาเลนเจอร์"],
  ["enchantments", "พลังแฝง"],
];

const SORTS: Record<CatalogKind, { label: string; col: string; asc: boolean }[]> = {
  items: [
    { label: "ชื่อ A→Z", col: "name", asc: true },
    { label: "ราคา ต่ำ→สูง", col: "cost", asc: true },
    { label: "ราคา สูง→ต่ำ", col: "cost", asc: false },
  ],
  rune: [
    { label: "ชื่อ A→Z", col: "name", asc: true },
    { label: "สี", col: "color", asc: true },
  ],
  spells: [
    { label: "ลำดับที่ตั้งไว้", col: "sort_order", asc: true },
    { label: "ชื่อ A→Z", col: "name", asc: true },
    { label: "แก้ไขล่าสุด", col: "updated_at", asc: false },
  ],
  enchantments: [
    { label: "ลำดับที่ตั้งไว้", col: "sort_order", asc: true },
    { label: "ชื่อ A→Z", col: "name", asc: true },
    { label: "แก้ไขล่าสุด", col: "updated_at", asc: false },
  ],
};

const BADGE: Record<VerifyState, string> = {
  verified: "border-win/40 bg-win/10 text-win",
  needs: "border-accent/40 bg-accent/10 text-accent",
  test: "border-rift/50 bg-rift/10 text-rift",
  inactive: "border-border bg-bg-raised text-text-faint",
};
const STATUS_BADGE: Record<string, string> = {
  active: "border-win/40 text-win",
  seasonal: "border-accent/40 text-accent",
  test_server: "border-rift/50 text-rift",
  inactive: "border-border text-text-faint",
};

const ctl =
  "block w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition placeholder:text-text-faint focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const inp = `${ctl} h-11`;
const area = `${ctl} min-h-[96px] resize-y py-2.5 leading-relaxed`;
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const btnPrimary = `${btn} bg-accent text-accent-fg hover:brightness-110`;
const btnSecondary = `${btn} border border-border bg-bg-raised text-text hover:border-text-faint`;
const btnDanger = `${btn} border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20`;
const btnDangerSolid = `${btn} bg-loss text-white hover:brightness-110`;

function Field({ label, error, hint, children, wide }: { label: string; error?: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-text-muted">{label}</span>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-text-faint">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 flex items-start gap-1 text-xs text-loss">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function Icon({ url, round, size = 40 }: { url?: string | null; round?: boolean; size?: number }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [url]);
  const cls = `shrink-0 border border-border bg-bg-raised object-cover ${round ? "rounded-[50%]" : "rounded-lg"}`;
  if (!url || bad) {
    return (
      <span className={`${cls} flex items-center justify-center text-[10px] text-text-faint`} style={{ width: size, height: size }}>
        ไม่มีรูป
      </span>
    );
  }
  return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" className={cls} style={{ width: size, height: size }} onError={() => setBad(true)} />;
}

function VerifyBadge({ row }: { row: Row }) {
  const s = verifyState(row);
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] leading-none ${BADGE[s]}`}>{VERIFY_LABEL[s]}</span>;
}

// ตัด/ลบอักขระที่ใช้เป็นไวยากรณ์ของ PostgREST .or() ออกจากคำค้น
const cleanQ = (s: string) => s.replace(/[,()%*\\]/g, " ").trim();

async function uploadImage(file: File, folder: string): Promise<string> {
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// จำนวนที่ถูกบิลด์อ้างอิง (ใช้ตัดสินใจว่าลบได้หรือไม่)
async function usageCount(kind: CatalogKind, id: string): Promise<number> {
  const count = async (table: string, col: string) => {
    const { count: n, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(col, id);
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  if (kind === "items") return count("item_build_items", "item_id");
  if (kind === "rune") return (await count("item_build_rune", "rune_id")) + (await count("item_builds", "rune_id"));
  if (kind === "spells") return count("item_builds", "challenger_spell_id");
  return count("item_build_enchantments", "enchantment_id");
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-card border border-border bg-bg-surface shadow-card sm:max-w-2xl sm:rounded-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded p-1 text-text-muted hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>{children}</div>
      </div>
    </div>
  );
}

function EditorModal({ kind, row, trees, onClose, onSaved }: { kind: CatalogKind; row: Row | null; trees: Row[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const table = TABLE[kind];
  const [f, setF] = useState<Form>(() => toForm(kind, row));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ n: number } | null>(null);
  const hasStatus = kind === "spells" || kind === "enchantments";
  const isNew = !row;
  const set = (k: string, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrs((x) => {
      if (!x[k]) return x;
      const { [k]: _drop, ...rest } = x;
      return rest;
    });
  };

  async function run(fn: () => PromiseLike<{ error: any }>, okMsg: string, failMsg: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(`${failMsg}: ${explainDbError(error)}`);
      return false;
    }
    toast.success(okMsg);
    onSaved();
    return true;
  }

  async function save() {
    const e = validate(kind, f);
    setErrs(e);
    if (Object.keys(e).length > 0) {
      toast.error("กรอกข้อมูลไม่ครบหรือไม่ถูกต้อง ตรวจช่องที่มีข้อความสีแดง");
      return;
    }
    const payload: Row = toPayload(kind, f);
    if (hasStatus && !isNew) payload.updated_at = new Date().toISOString();
    if (isNew) await run(() => db.from(table).insert(payload), "เพิ่มแล้ว", "เพิ่มไม่สำเร็จ");
    else await run(() => db.from(table).update(payload).eq("id", row!.id), "บันทึกแล้ว", "บันทึกไม่สำเร็จ");
  }

  // verified_at ส่งเฉพาะช่องนี้ช่องเดียว ไม่แก้เนื้อหา (trigger ใน DB บันทึกว่าใครยืนยัน และเคลียร์เมื่อเนื้อหาเปลี่ยน)
  const setVerified = (on: boolean) =>
    run(() => db.from(table).update({ verified_at: on ? new Date().toISOString() : null }).eq("id", row!.id), on ? "ทำเครื่องหมายว่ายืนยันแล้ว" : "ยกเลิกการยืนยันแล้ว", "อัปเดตการยืนยันไม่สำเร็จ");
  const deactivate = () =>
    run(() => db.from(table).update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", row!.id), "ปิดการใช้งานแล้ว", "ปิดการใช้งานไม่สำเร็จ");

  async function askDelete() {
    try {
      setBusy(true);
      setConfirmDel({ n: await usageCount(kind, row!.id) });
    } catch (e) {
      toast.error(`ตรวจสอบการอ้างอิงไม่สำเร็จ: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  const del = () => run(() => db.from(table).delete().eq("id", row!.id), "ลบแล้ว", "ลบไม่สำเร็จ");

  const text = (k: string, label: string, opt?: { hint?: string; type?: string; wide?: boolean; ph?: string }) => (
    <Field label={label} error={errs[k]} hint={opt?.hint} wide={opt?.wide}>
      <input className={inp} type={opt?.type ?? "text"} inputMode={opt?.type === "number" ? "numeric" : undefined} placeholder={opt?.ph} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errs[k]} />
    </Field>
  );
  const select = (k: string, label: string, opts: { value: string; label: string }[], blank?: string, wide?: boolean) => (
    <Field label={label} error={errs[k]} wide={wide}>
      <select className={inp} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errs[k]}>
        {blank !== undefined && <option value="">{blank}</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );

  const verified = !!row?.verified_at;

  return (
    <Modal title={isNew ? `เพิ่ม${KINDS.find(([k]) => k === kind)![1]}` : `แก้ไข: ${row!.name}`} onClose={onClose}>
      <div className="space-y-4">
        {!isNew && (
          <div className="space-y-2 rounded-lg border border-border bg-bg-raised p-3">
            <div className="flex flex-wrap items-center gap-2">
              <VerifyBadge row={row!} />
              {hasStatus && <span className={`rounded-full border px-2 py-0.5 text-[11px] leading-none ${STATUS_BADGE[row!.status] ?? ""}`}>{row!.status}</span>}
            </div>
            {row!.status === "test_server" && <p className="text-xs text-rift">เนื้อหานี้มาจาก Test Server — ห้ามแสดงเป็นข้อมูลเกมจริงจนกว่าจะยืนยัน</p>}
            {verified && <p className="text-xs text-text-muted">การแก้เนื้อหาใด ๆ จะล้างสถานะ "ยืนยันแล้ว" อัตโนมัติ ต้องตรวจกับเกมใหม่</p>}
            <button type="button" disabled={busy} onClick={() => void setVerified(!verified)} className={`${btnSecondary} w-full sm:w-auto`}>
              <ShieldCheck className="h-4 w-4" />
              {verified ? "ยกเลิกการยืนยัน" : "ตรวจกับเกมจริงแล้ว — ทำเครื่องหมายว่ายืนยัน"}
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {text("name", "ชื่ออังกฤษ")}
          {kind !== "rune" && text("name_th", "ชื่อไทย")}
          {kind !== "rune" && text("slug", "slug", { hint: "a-z 0-9 และขีดกลาง ใช้เป็นรหัสอ้างอิง" })}

          {kind === "items" && (
            <>
              {text("cost", "ราคา (ทอง)", { type: "number" })}
              {select("tier", "ระดับ (Tier)", [1, 2, 3].map((n) => ({ value: String(n), label: `T${n}` })), "— ยังไม่ระบุ —")}
              <Field label="ประเภท (เลือกได้หลายตัว)" wide>
                <div className="flex flex-wrap gap-2">
                  {ITEM_TYPES.map((o) => {
                    const cur = (f.role_tags ?? "").split(",").filter(Boolean);
                    const on = cur.includes(o.value);
                    return (
                      <button key={o.value} type="button" aria-pressed={on} onClick={() => set("role_tags", (on ? cur.filter((x) => x !== o.value) : [...cur, o.value]).join(","))}
                        className={`h-10 rounded-full border px-4 text-sm transition ${on ? "border-accent bg-accent/15 font-medium text-accent" : "border-border bg-bg-raised text-text-muted hover:border-text-faint"}`}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="ค่าสถานะ (หนึ่งบรรทัดต่อหนึ่งค่า)" wide error={errs.stats}>
                <textarea className={area} rows={3} value={f.stats ?? ""} onChange={(e) => set("stats", e.target.value)} />
              </Field>
              <Field label="อาวุธ/พาสซีฟ" wide error={errs.passive}>
                <textarea className={area} rows={3} value={f.passive ?? ""} onChange={(e) => set("passive", e.target.value)} />
              </Field>
            </>
          )}

          {kind === "rune" && (
            <>
              {select("color", "สี", RUNE_COLORS, "— ไม่ระบุ —")}
              <Field label="คำอธิบาย / ค่าสถานะ" wide error={errs.description}>
                <textarea className={area} rows={3} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </>
          )}

          {kind === "spells" && (
            <>
              {text("cooldown_seconds", "คูลดาวน์ (วินาที)", { type: "number" })}
              {select("status", "สถานะ", STATUSES as any)}
              {text("sort_order", "ลำดับแสดง", { type: "number" })}
              <Field label="คำอธิบาย" wide error={errs.description}>
                <textarea className={area} rows={3} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </>
          )}

          {kind === "enchantments" && (
            <>
              {select("tree_id", "สาย (Tree)", trees.map((t) => ({ value: t.id, label: `${t.name_th} (${t.name})` })), "— เลือกสาย —")}
              {select("tier_level", "ระดับ (Tier)", [1, 2, 3].map((n) => ({ value: String(n), label: `Tier ${n}` })), "— ไม่ระบุ —")}
              {select("category", "ประเภท", ENCH_CATEGORIES)}
              {select("status", "สถานะ", STATUSES as any)}
              {text("sort_order", "ลำดับแสดง", { type: "number" })}
              <Field label="คำอธิบาย" wide error={errs.description}>
                <textarea className={area} rows={3} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </>
          )}

          {(kind === "spells" || kind === "enchantments") && text("source_url", "แหล่งอ้างอิง (URL)", { wide: true, ph: "https://..." })}

          <Field label="ไอคอน" error={errs.icon_url} wide>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon url={(f.icon_url ?? "").trim() || null} round={kind === "rune" || kind === "spells"} />
                <input className={inp} placeholder="วาง URL รูป" value={f.icon_url ?? ""} onChange={(e) => set("icon_url", e.target.value)} aria-invalid={!!errs.icon_url} />
              </div>
              <label className={`${btnSecondary} w-full cursor-pointer sm:w-auto`}>
                อัปโหลดรูป
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const input = e.target;
                  const file = input.files?.[0];
                  if (!file) return;
                  try { set("icon_url", await uploadImage(file, table)); } catch (er) { toast.error(`อัปโหลดไม่สำเร็จ: ${(er as Error).message}`); }
                  input.value = "";
                }} />
              </label>
            </div>
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecondary} onClick={onClose}>ยกเลิก</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} บันทึก
          </button>
        </div>

        {!isNew && (
          <div className="space-y-2 border-t border-border pt-4">
            {confirmDel ? (
              confirmDel.n > 0 ? (
                <div className="space-y-2 rounded-lg border border-loss/40 bg-loss/5 p-3 text-sm">
                  <p className="text-loss">ลบไม่ได้: รายการนี้ถูกอ้างอิงใน {confirmDel.n} แถวของบิลด์/เนื้อหา{hasStatus ? " — ใช้ \"ปิดการใช้งาน\" แทน" : ""}</p>
                  <button type="button" className={btnSecondary} onClick={() => setConfirmDel(null)}>ปิด</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-sm text-text-muted sm:mr-auto">ไม่มีการอ้างอิง — ลบถาวร?</span>
                  <button type="button" className={btnSecondary} onClick={() => setConfirmDel(null)}>ยกเลิก</button>
                  <button type="button" className={btnDangerSolid} disabled={busy} onClick={() => void del()}><Trash2 className="h-4 w-4" />ยืนยันลบ</button>
                </div>
              )
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                {hasStatus && row!.status !== "inactive" && <button type="button" className={btnSecondary} disabled={busy} onClick={() => void deactivate()}>ปิดการใช้งาน (แนะนำแทนการลบ)</button>}
                <button type="button" className={btnDanger} disabled={busy} onClick={() => void askDelete()}><Trash2 className="h-4 w-4" />ลบ</button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Catalog({ kind }: { kind: CatalogKind }) {
  const toast = useToast();
  const table = TABLE[kind];
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortIdx, setSortIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trees, setTrees] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [tick, setTick] = useState(0);
  const sort = SORTS[kind][sortIdx] ?? SORTS[kind][0];
  const treeName = useMemo(() => new Map(trees.map((t) => [t.id, t.name_th as string])), [trees]);

  useEffect(() => {
    const id = window.setTimeout(() => { setDq(cleanQ(q)); setPage(0); }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (kind !== "enchantments") return;
    void db.from("enchantment_trees").select("id,name,name_th").order("sort_order").then(({ data, error: e }: any) => {
      if (e) toast.error(`โหลดรายการสายไม่สำเร็จ: ${e.message}`);
      else setTrees(data ?? []);
    });
  }, [kind, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let r = db.from(table).select("*", { count: "exact" });
    if (dq) {
      const cols = kind === "rune" ? ["name"] : ["name", "name_th", "slug"];
      r = r.or(cols.map((c) => `${c}.ilike.%${dq}%`).join(","));
    }
    const fl = filters;
    if (fl.verify === "verified") r = r.not("verified_at", "is", null);
    if (fl.verify === "needs") r = r.is("verified_at", null);
    if (fl.status) r = r.eq("status", fl.status);
    if (fl.color) r = r.eq("color", fl.color);
    if (fl.type) r = r.contains("role_tags", [fl.type]);
    if (fl.category) r = r.eq("category", fl.category);
    if (fl.tree) r = r.eq("tree_id", fl.tree);
    if (fl.tier) {
      const col = kind === "items" ? "tier" : "tier_level";
      r = fl.tier === "none" ? r.is(col, null) : r.eq(col, Number(fl.tier));
    }
    r = r.order(sort.col, { ascending: sort.asc }).order("id").range(page * PAGE, page * PAGE + PAGE - 1);
    const { data, error: e, count } = await r;
    if (e) setError(e.message);
    else {
      setRows(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [table, kind, dq, filters, sort.col, sort.asc, page, tick]);

  useEffect(() => { void load(); }, [load]);

  const setFilter = (k: string, v: string) => { setFilters((x) => ({ ...x, [k]: v })); setPage(0); };
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const sel = (k: string, label: string, opts: { value: string; label: string }[]) => (
    <select aria-label={label} className={`${inp} sm:w-auto sm:min-w-[9rem]`} value={filters[k] ?? ""} onChange={(e) => setFilter(k, e.target.value)}>
      <option value="">{label}: ทั้งหมด</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <input type="search" className={`${inp} pl-9`} placeholder={kind === "rune" ? "ค้นหาชื่อรูน..." : "ค้นหาชื่อไทย / อังกฤษ / slug..."} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {sel("verify", "การยืนยัน", [{ value: "verified", label: "ยืนยันแล้ว" }, { value: "needs", label: "รอตรวจสอบ" }])}
        {(kind === "spells" || kind === "enchantments") && sel("status", "สถานะ", STATUSES as any)}
        {kind === "items" && sel("tier", "Tier", [{ value: "1", label: "T1" }, { value: "2", label: "T2" }, { value: "3", label: "T3" }, { value: "none", label: "ยังไม่ระบุ" }])}
        {kind === "items" && sel("type", "ประเภท", ITEM_TYPES)}
        {kind === "rune" && sel("color", "สี", RUNE_COLORS)}
        {kind === "enchantments" && sel("tree", "สาย", trees.map((t) => ({ value: t.id, label: t.name_th })))}
        {kind === "enchantments" && sel("tier", "Tier", [{ value: "1", label: "Tier 1" }, { value: "2", label: "Tier 2" }, { value: "3", label: "Tier 3" }, { value: "none", label: "ไม่ระบุ" }])}
        {kind === "enchantments" && sel("category", "ประเภท", ENCH_CATEGORIES)}
        <select aria-label="เรียงตาม" className={`${inp} sm:w-auto`} value={sortIdx} onChange={(e) => { setSortIdx(Number(e.target.value)); setPage(0); }}>
          {SORTS[kind].map((s, i) => <option key={s.label} value={i}>เรียง: {s.label}</option>)}
        </select>
        <button type="button" className={`${btnPrimary} sm:ml-auto`} onClick={() => setEditing("new")}><Plus className="h-4 w-4" />เพิ่ม</button>
      </div>

      {kind === "spells" || kind === "enchantments" ? (
        <p className="text-xs text-text-faint">รายการ Test Server จะไม่ถูกนับเป็นข้อมูลเกมจริง · การยืนยันจะถูกล้างอัตโนมัติเมื่อแก้เนื้อหา</p>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-loss/40 bg-loss/5 p-4 text-sm text-loss">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">โหลดข้อมูลไม่สำเร็จ: {error}</span>
          <button type="button" className="underline" onClick={() => setTick((n) => n + 1)}>ลองอีกครั้ง</button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="flex items-center gap-2 p-6 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-text-muted">ไม่พบรายการที่ตรงกับตัวกรองหรือคำค้นหา</p>
      ) : (
        <div className={`grid gap-2 lg:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
          {rows.map((row) => (
            <button key={row.id} type="button" onClick={() => setEditing(row)} className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-bg-surface p-3 text-left shadow-card transition hover:border-accent/40">
              <Icon url={row.icon_url} round={kind === "rune" || kind === "spells"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.name}{row.name_th ? ` · ${row.name_th}` : ""}</span>
                <span className="block truncate text-xs text-text-muted">
                  {[
                    row.slug,
                    kind === "items" && `${row.cost} ทอง${row.tier ? ` · T${row.tier}` : ""}`,
                    kind === "rune" && row.color,
                    kind === "spells" && row.cooldown_seconds != null && `CD ${row.cooldown_seconds}s`,
                    kind === "enchantments" && `${treeName.get(row.tree_id) ?? "?"}${row.tier_level ? ` · Tier ${row.tier_level}` : ""} · ${row.category}`,
                  ].filter(Boolean).join(" · ")}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  <VerifyBadge row={row} />
                  {row.status && <span className={`rounded-full border px-2 py-0.5 text-[11px] leading-none ${STATUS_BADGE[row.status] ?? ""}`}>{row.status}</span>}
                  {!row.icon_url && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] leading-none text-text-faint">ไม่มีไอคอน</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>{total} รายการ · หน้า {page + 1}/{pages}</span>
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)} aria-label="หน้าก่อนหน้า"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className={btnSecondary} disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="หน้าถัดไป"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {editing && (
        <EditorModal
          kind={kind}
          row={editing === "new" ? null : editing}
          trees={trees}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setTick((n) => n + 1); }}
        />
      )}
    </div>
  );
}

// แท็บ "ฐานข้อมูลเกม" ใน /admin — สิทธิ์ตรวจที่ AdminHub (UI) และบังคับจริงที่ RLS (is_admin())
export function AdminGameData() {
  const [kind, setKind] = usePersistedState<CatalogKind>("admin:game:kind", "items");
  const k: CatalogKind = KINDS.some(([x]) => x === kind) ? kind : "items";
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="ฐานข้อมูลเกม" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {KINDS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={k === key} onClick={() => setKind(key)}
            className={`h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition ${k === key ? "border-accent bg-accent font-medium text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:border-text-faint hover:text-text"}`}>
            {label}
          </button>
        ))}
      </div>
      <Catalog key={k} kind={k} />
    </div>
  );
}
