/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { explainDbError } from "@/lib/catalogAdmin";
import {
  PRIMARY_SLOTS,
  SECONDARY_SLOTS,
  canPick,
  canRemove,
  pickerOptions,
  primaryTree,
  validateSelection,
  type EnchOpt,
  type SelRow,
  type SelectionType,
} from "@/lib/enchantmentRules";
import { BuildPicker, type BuildRow } from "./BuildPicker";
import { Thumb } from "./ImageSelect";

const db: any = supabase;

type Tree = { id: string; name: string; name_th: string; icon_url: string | null };
type Slot = { type: SelectionType; n: number };
type DbRow = SelRow & { id: string };

// ข้อความ error ของ trigger (23514) เป็นภาษาไทยอธิบายกติกาอยู่แล้ว แสดงตามนั้น; 23505 ในตารางนี้ = ช่องซ้ำหรือเลือกตัวเดิมซ้ำ
const explain = (e: { code?: string; message: string }) =>
  e.code === "23514" ? e.message : e.code === "23505" ? "ช่องนี้ถูกใช้แล้วหรือเลือกพลังแฝงซ้ำ ลองรีเฟรชแล้วทำใหม่" : explainDbError(e);

const slotKey = (s: Slot) => `${s.type}:${s.n}`;
const SLOT_LABEL = (s: Slot) => (s.type === "primary" ? `Tier ${s.n}` : `ช่อง ${s.n}`);

// แท็บ "พลังแฝงในบิลด์": สายหลัก 3 ช่อง (Tier 1–3 จากสายเดียวกัน) + สายรอง 2 ช่อง (ห้ามสายเดียวกับสายหลัก)
// กติกาทั้งหมดอยู่ที่ src/lib/enchantmentRules.ts และ trigger ใน migration 20261011 — ตัวเลือกที่ผิดกติกาจะจางลง แตะแล้วบอกเหตุผล
export function BuildEnchantmentEditor() {
  const toast = useToast();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [options, setOptions] = useState<EnchOpt[]>([]);
  const [build, setBuild] = useState<BuildRow | null>(null);
  const [heroName, setHeroName] = useState("");
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Slot | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // แคตตาล็อกพลังแฝงโหลดครั้งเดียว (รวม inactive ไว้ด้วย เพื่อแสดงบิลด์เดิมที่อ้างถึงได้ครบ แต่เลือกใหม่ไม่ได้)
  useEffect(() => {
    let alive = true;
    void Promise.all([
      db.from("enchantment_trees").select("id,name,name_th,icon_url").order("sort_order", { ascending: true }),
      db
        .from("enchantments")
        .select("id,name,name_th,tree_id,tier_level,status,icon_url,verified_at")
        .order("tier_level", { ascending: true })
        .order("sort_order", { ascending: true }),
    ]).then(([t, e]) => {
      if (!alive) return;
      if (t.error || e.error) toast.error(`โหลดพลังแฝงไม่สำเร็จ: ${(t.error ?? e.error).message}`);
      setTrees((t.data ?? []) as Tree[]);
      setOptions(
        ((e.data ?? []) as any[]).map((r) => ({
          id: r.id,
          name: r.name,
          nameTh: r.name_th,
          treeId: r.tree_id,
          tier: r.tier_level ?? null,
          status: r.status,
          icon: r.icon_url ?? undefined,
          verified: !!r.verified_at,
        }))
      );
    });
    return () => {
      alive = false;
    };
  }, [toast]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const treeById = useMemo(() => new Map(trees.map((t) => [t.id, t])), [trees]);

  const onBuild = useCallback((b: BuildRow | null, name: string) => {
    setBuild(b);
    setHeroName(name);
    setOpen(null);
  }, []);

  // แถวพลังแฝงของบิลด์ที่เลือก
  useEffect(() => {
    if (!build) {
      setRows([]);
      return;
    }
    let alive = true;
    setLoadingRows(true);
    void db
      .from("item_build_enchantments")
      .select("id,enchantment_id,selection_type,sort_order")
      .eq("build_id", build.id)
      .then(({ data, error }: { data: DbRow[] | null; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) toast.error(`โหลดพลังแฝงของบิลด์ไม่สำเร็จ: ${error.message}`);
        setRows(data ?? []);
        setLoadingRows(false);
      });
    return () => {
      alive = false;
    };
  }, [build?.id, reloadKey, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowAt = (s: Slot) => rows.find((r) => r.selection_type === s.type && r.sort_order === s.n);
  const problems = useMemo(() => validateSelection(rows, byId), [rows, byId]);
  const pTree = primaryTree(rows, byId);

  async function run(job: () => PromiseLike<{ error: { code?: string; message: string } | null }>, okMsg: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await job();
    setBusy(false);
    if (error) {
      toast.error(`บันทึกไม่สำเร็จ: ${explain(error)}`);
      return;
    }
    toast.success(okMsg);
    setOpen(null);
    setReloadKey((k) => k + 1);
  }

  function pick(slot: Slot, opt: EnchOpt) {
    if (!build) return;
    const check = canPick(rows, byId, slot.type, slot.n, opt);
    if (!check.ok) {
      toast.info(check.reason);
      return;
    }
    const existing = rowAt(slot);
    if (existing) {
      void run(() => db.from("item_build_enchantments").update({ enchantment_id: opt.id }).eq("id", existing.id), "เปลี่ยนพลังแฝงแล้ว");
    } else {
      void run(
        () => db.from("item_build_enchantments").insert({ build_id: build.id, enchantment_id: opt.id, selection_type: slot.type, sort_order: slot.n }),
        "เพิ่มพลังแฝงแล้ว"
      );
    }
  }

  function remove(slot: Slot) {
    const existing = rowAt(slot);
    if (!existing) return;
    const check = canRemove(rows, byId, slot.type, slot.n);
    if (!check.ok) {
      toast.info(check.reason);
      return;
    }
    void run(() => db.from("item_build_enchantments").delete().eq("id", existing.id), "เอาพลังแฝงออกแล้ว");
  }

  function clear(type: SelectionType) {
    if (!build) return;
    const label = type === "primary" ? "สายหลัก" : "สายรอง";
    if (!window.confirm(`ล้างพลังแฝง${label}ทั้งหมดของบิลด์นี้?`)) return;
    void run(() => db.from("item_build_enchantments").delete().eq("build_id", build.id).eq("selection_type", type), `ล้าง${label}แล้ว`);
  }

  const slotCard = (slot: Slot) => {
    const row = rowAt(slot);
    const o = row ? byId.get(row.enchantment_id) : undefined;
    const active = open && slotKey(open) === slotKey(slot);
    return (
      <div key={slotKey(slot)} className="relative min-w-0">
        <button
          type="button"
          aria-label={o ? `${SLOT_LABEL(slot)}: ${o.name}` : `เลือกพลังแฝง ${SLOT_LABEL(slot)}`}
          aria-pressed={!!active}
          disabled={busy}
          onClick={() => setOpen(active ? null : slot)}
          className={`flex aspect-[4/5] w-full flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-center transition hover:border-accent/40 disabled:opacity-60 ${
            o ? "bg-bg-surface" : "border-dashed bg-bg-surface"
          } ${active ? "border-accent ring-2 ring-accent" : "border-border"}`}
        >
          <span className="text-[10px] font-medium text-text-faint">{SLOT_LABEL(slot)}</span>
          {o ? (
            <>
              <Thumb src={o.icon} label={o.name} className="h-11 w-11" />
              <span className="w-full truncate text-[11px] font-medium leading-tight">{o.name}</span>
              <span className="w-full truncate text-[10px] leading-tight text-text-faint">{o.nameTh}</span>
            </>
          ) : (
            <Plus className="h-5 w-5 text-text-faint" />
          )}
        </button>
        {o && (
          <button
            type="button"
            aria-label="เอาพลังแฝงออก"
            disabled={busy}
            onClick={() => remove(slot)}
            className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {o && !o.verified && <span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-accent" title="รอตรวจสอบกับเกมจริง" />}
      </div>
    );
  };

  const treeName = (id?: string | null) => (id ? treeById.get(id)?.name_th ?? "?" : "");

  // กริดเลือกพลังแฝงของช่องที่เปิดอยู่ จัดกลุ่มตามสาย; ตัวที่เลือกไม่ได้จางลง แตะแล้วขึ้นเหตุผล
  const picker = open
    ? (() => {
        const list = pickerOptions(rows, byId, options, open.type, open.n);
        const groups = trees
          .map((t) => ({ tree: t, items: list.filter((x) => x.opt.treeId === t.id) }))
          .filter((g) => g.items.length > 0);
        return (
          <div className="space-y-3 rounded-card border border-border bg-bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-text-muted">
                เลือกพลังแฝง · {open.type === "primary" ? "สายหลัก" : "สายรอง"} {SLOT_LABEL(open)}
              </p>
              <button type="button" onClick={() => setOpen(null)} aria-label="ปิด" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-raised">
                <X className="h-4 w-4" />
              </button>
            </div>
            {groups.map(({ tree, items }) => (
              <div key={tree.id}>
                <p className="mb-1.5 text-xs font-medium text-text-faint">{tree.name_th}</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {items.map(({ opt, check }) => {
                    const selected = rowAt(open)?.enchantment_id === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-disabled={!check.ok}
                        disabled={busy}
                        onClick={() => (selected ? setOpen(null) : pick(open, opt))}
                        title={check.ok ? opt.name : check.reason}
                        className={`flex flex-col items-center gap-1 rounded-lg border bg-bg p-1.5 text-center transition hover:border-accent/40 ${
                          selected ? "border-accent ring-2 ring-accent" : "border-border"
                        } ${check.ok ? "" : "opacity-35"}`}
                      >
                        <Thumb src={opt.icon} label={opt.name} className="h-10 w-10" />
                        <span className="w-full truncate text-[10px] leading-tight">{opt.name}</span>
                        <span className="w-full truncate text-[10px] leading-tight text-text-faint">{opt.nameTh}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="py-3 text-center text-sm text-text-muted">ไม่มีพลังแฝงที่ตรงกับช่องนี้</p>}
          </div>
        );
      })()
    : null;

  const sectionHead = (title: string, hint: string, type: SelectionType, tree?: string | null) => (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {title}
          {tree ? <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{tree}</span> : null}
        </p>
        <p className="text-[11px] text-text-faint">{hint}</p>
      </div>
      <button
        type="button"
        disabled={busy || !rows.some((r) => r.selection_type === type)}
        onClick={() => clear(type)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-bg-raised px-3 text-xs text-text-muted hover:border-loss/50 hover:text-loss disabled:pointer-events-none disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        ล้าง
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="font-display text-base font-semibold">พลังแฝงในบิลด์</h2>

      <BuildPicker persistKey="admin:buildEnchant" reloadKey={0} onBuild={onBuild} />

      {build && (
        <section className="space-y-5 rounded-card border border-border bg-bg-surface p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-text-muted">
            {heroName} · {build.patchCode} · {build.source}
            {(loadingRows || busy) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </p>

          <div className="space-y-2">
            {sectionHead("สายหลัก", `เลือกได้ถึง Tier ${PRIMARY_SLOTS} · ทุกช่องต้องมาจากสายเดียวกัน`, "primary", treeName(pTree))}
            <div className="grid max-w-md grid-cols-3 gap-2">{Array.from({ length: PRIMARY_SLOTS }, (_, i) => slotCard({ type: "primary", n: i + 1 }))}</div>
          </div>

          <div className="space-y-2">
            {sectionHead(
              "สายรอง",
              `${SECONDARY_SLOTS} ช่อง · ห้ามเป็นสายเดียวกับสายหลัก · Tier 1 สองอัน หรือ Tier 1 + Tier 2 (ต้องสายเดียวกัน)`,
              "secondary"
            )}
            <div className="grid max-w-[16rem] grid-cols-2 gap-2">{Array.from({ length: SECONDARY_SLOTS }, (_, i) => slotCard({ type: "secondary", n: i + 1 }))}</div>
          </div>

          {problems.length > 0 && (
            <ul className="space-y-1">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-xs text-loss">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          )}

          {picker}
        </section>
      )}
    </div>
  );
}
