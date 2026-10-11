/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Gem, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { explainDbError } from "@/lib/catalogAdmin";
import {
  canPick,
  canRemove,
  pickerOptions,
  primaryTree,
  requiredTier,
  slotAvailable,
  treeAt,
  treeChoices,
  validateSelection,
  type EnchOpt,
  type SelRow,
  type SelectionType,
} from "@/lib/enchantmentRules";
import { BuildPicker, type BuildRow } from "./BuildPicker";
import { Thumb } from "./ImageSelect";

const db: any = supabase;

type Tree = { id: string; slug: string; name: string; name_th: string; icon_url: string | null };
type DbRow = SelRow & { id: string };
type Align = "start" | "center" | "end";
type Pop = { kind: "tree" | "node"; type: SelectionType; slot: number; align: Align };

// สีประจำสาย (ใช้แต่งเส้น/ขอบ/ไอคอนสีให้เหมือนในเกมเท่านั้น ไม่มีผลกับกติกา) — สายที่ไม่รู้จักใช้สีเทา
const TREE_HEX: Record<string, string> = { lokheim: "#ef4444", veda: "#eab308", afata: "#22c55e", "league-of-humans": "#3b82f6" };
const NEUTRAL = "#64748b";
const ROMAN = ["", "I", "II", "III"];

// ข้อความ error ของ trigger (23514) เป็นภาษาไทยอธิบายกติกาอยู่แล้ว แสดงตามนั้น; 23505 ในตารางนี้ = ช่องซ้ำหรือเลือกตัวเดิมซ้ำ
const explain = (e: { code?: string; message: string }) =>
  e.code === "23514" ? e.message : e.code === "23505" ? "ช่องนี้ถูกใช้แล้วหรือเลือกพลังแฝงซ้ำ ลองรีเฟรชแล้วทำใหม่" : explainDbError(e);

// ไอคอนสี (สาย): มีรูปใช้รูป ไม่มีใช้เพชรสีประจำสาย
function TreeGlyph({ tree, size = 28 }: { tree: Tree | null; size?: number }) {
  if (tree?.icon_url) return <Thumb src={tree.icon_url} label={tree.name} bare className="h-full w-full" />;
  return <Gem style={{ width: size, height: size, color: tree ? TREE_HEX[tree.slug] ?? NEUTRAL : NEUTRAL }} strokeWidth={1.75} aria-hidden />;
}

// แตะไอคอนสีเพื่อเลือกสีของสาย (วงกลมใหญ่ด้านซ้ายของแถว เหมือนในเกม)
function TreeButton({ tree, active, label, onClick }: { tree: Tree | null; active: boolean; label: string; onClick: () => void }) {
  const hex = tree ? TREE_HEX[tree.slug] ?? NEUTRAL : NEUTRAL;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[50%] border-2 bg-black/20 transition hover:brightness-125 ${
        tree ? "" : "border-dashed"
      } ${active ? "ring-2 ring-accent" : ""}`}
      style={{ borderColor: hex }}
    >
      {tree ? <TreeGlyph tree={tree} /> : <Plus className="h-5 w-5 text-text-faint" />}
    </button>
  );
}

// โหนดพลังแฝง: วงกลม (Tier I / II) หรือข้าวหลามตัด (Tier III) พื้นหลังโปร่งใส ไอคอนแสดงเต็มรูป ไม่ตัดเป็นวงกลม
function NodeButton({
  opt,
  tier,
  diamond,
  hex,
  active,
  locked,
  label,
  onClick,
}: {
  opt?: EnchOpt;
  tier: number;
  diamond?: boolean;
  hex: string;
  active: boolean;
  locked?: boolean;
  label: string;
  onClick: () => void;
}) {
  const icon = opt ? <Thumb src={opt.icon} label={opt.name} bare className="h-9 w-9" /> : null;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex h-14 w-14 shrink-0 items-center justify-center transition hover:brightness-125 ${locked ? "opacity-40" : ""}`}
    >
      {diamond ? (
        <span
          className={`flex h-10 w-10 rotate-45 items-center justify-center rounded-md border-2 bg-black/20 ${active ? "ring-2 ring-accent" : ""}`}
          style={{ borderColor: hex }}
        >
          <span className="-rotate-45">{icon}</span>
        </span>
      ) : (
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-[50%] border-2 bg-black/20 ${active ? "ring-2 ring-accent" : ""}`}
          style={{ borderColor: hex }}
        >
          {icon}
        </span>
      )}
      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-bg px-1.5 text-[10px] font-semibold leading-4 text-text-muted">{ROMAN[tier]}</span>
      {opt && !opt.verified && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" title="รอตรวจสอบกับเกมจริง" />}
    </button>
  );
}

const Line = ({ hex, dim }: { hex: string; dim?: boolean }) => (
  <span className="h-0.5 min-w-2 flex-1" style={{ backgroundColor: hex, opacity: dim ? 0.35 : 0.9 }} />
);

// แท็บ "พลังแฝงในบิลด์": หน้าตาเลียนแบบหน้าพลังแฝงในเกม
//   สายหลัก = ไอคอนสี → โหนด I → II → III (เลือกได้ถึง Tier 3 จากสีเดียวกัน)
//   สายรอง  = 2 ช่อง แต่ละช่องมีไอคอนสีของตัวเอง (ห้ามสีเดียวกับสายหลัก) ช่อง 1 = Tier I, ช่อง 2 = Tier I ถ้าคนละสี / Tier II ถ้าสีเดียวกับช่อง 1
// แตะไอคอนสีเพื่อเลือกสี แตะโหนดเพื่อเลือกพลังแฝง (ป๊อปอัปใต้แถว) — ตัวที่ผิดกติกาจะจาง แตะแล้วบอกเหตุผล
// กติกาอยู่ที่ src/lib/enchantmentRules.ts และ trigger ใน migration 20261011
export function BuildEnchantmentEditor() {
  const toast = useToast();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [options, setOptions] = useState<EnchOpt[]>([]);
  const [build, setBuild] = useState<BuildRow | null>(null);
  const [heroName, setHeroName] = useState("");
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Pop | null>(null);
  // สีที่เลือกไว้แล้วแต่ยังไม่ได้เลือกพลังแฝง (ยังไม่มีแถวใน DB): คีย์ "primary" หรือ "secondary:<ช่อง>"
  const [pending, setPending] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  // แคตตาล็อกพลังแฝงโหลดครั้งเดียว (รวม inactive ไว้ด้วย เพื่อแสดงบิลด์เดิมที่อ้างถึงได้ครบ แต่เลือกใหม่ไม่ได้)
  useEffect(() => {
    let alive = true;
    void Promise.all([
      db.from("enchantment_trees").select("id,slug,name,name_th,icon_url").order("sort_order", { ascending: true }),
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
  const treeIds = useMemo(() => trees.map((t) => t.id), [trees]);

  // เปลี่ยนฮีโร่/บิลด์ → ทิ้งสีที่เลือกค้างและปิดป๊อปอัป (ไม่ทำใน updater ของ setState เพื่อไม่ให้เกิดผลข้างเคียงซ้ำ)
  const buildIdRef = useRef<string | undefined>(undefined);
  const onBuild = useCallback((b: BuildRow | null, name: string) => {
    if (buildIdRef.current !== b?.id) {
      buildIdRef.current = b?.id;
      setPending({});
      setOpen(null);
    }
    setBuild(b);
    setHeroName(name);
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

  // แตะนอกกระดาน หรือกด Esc = ปิดป๊อปอัป
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (boardRef.current && !boardRef.current.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const rowAt = (type: SelectionType, slot: number) => rows.find((r) => r.selection_type === type && r.sort_order === slot);
  const optAt = (type: SelectionType, slot: number) => {
    const r = rowAt(type, slot);
    return r ? byId.get(r.enchantment_id) : undefined;
  };
  const problems = useMemo(() => validateSelection(rows, byId), [rows, byId]);

  // สีที่ใช้อยู่จริงของแต่ละช่อง: จากพลังแฝงที่เลือกไว้ ถ้ายังไม่มีใช้สีที่เลือกค้างไว้
  const primaryTreeId = primaryTree(rows, byId) ?? pending.primary ?? null;
  const secondaryTreeId = (slot: number) => treeAt(rows, byId, "secondary", slot) ?? pending[`secondary:${slot}`] ?? null;
  const treeOf = (id: string | null) => (id ? treeById.get(id) ?? null : null);
  const hexOf = (id: string | null) => (id ? TREE_HEX[treeById.get(id)?.slug ?? ""] ?? NEUTRAL : NEUTRAL);

  async function run(job: () => PromiseLike<{ error: { code?: string; message: string } | null }>, okMsg: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    const { error } = await job();
    setBusy(false);
    if (error) {
      toast.error(`บันทึกไม่สำเร็จ: ${explain(error)}`);
      return false;
    }
    toast.success(okMsg);
    setOpen(null);
    setReloadKey((k) => k + 1);
    return true;
  }

  async function chooseTree(type: SelectionType, slot: number, treeId: string) {
    if (!build) return;
    const choice = treeChoices(rows, byId, treeIds, type, slot).find((c) => c.treeId === treeId);
    if (choice && !choice.check.ok) {
      toast.info(choice.check.reason);
      return;
    }
    setOpen(null);
    if (type === "primary") {
      if (treeId === primaryTreeId) return;
      if (rows.some((r) => r.selection_type === "primary")) {
        const yes = await confirmDialog({
          title: "เปลี่ยนสีสายหลัก?",
          message: "พลังแฝงสายหลักที่เลือกไว้ในบิลด์นี้จะถูกล้างทั้งหมด",
          confirmLabel: "เปลี่ยนและล้าง",
          danger: true,
        });
        if (!yes) return;
        const done = await run(() => db.from("item_build_enchantments").delete().eq("build_id", build.id).eq("selection_type", "primary"), "เปลี่ยนสีสายหลักแล้ว");
        if (!done) return;
      }
      // สีที่เลือกค้างของสายรองที่ซ้ำกับสายหลักใหม่ ต้องเคลียร์ทิ้ง
      setPending((p) => Object.fromEntries(Object.entries({ ...p, primary: treeId }).filter(([k, v]) => k === "primary" || v !== treeId)));
      return;
    }
    if (treeId === secondaryTreeId(slot)) return;
    const existing = rowAt("secondary", slot);
    if (existing) {
      const done = await run(() => db.from("item_build_enchantments").delete().eq("id", existing.id), "เปลี่ยนสีแล้ว");
      if (!done) return;
    }
    setPending((p) => ({ ...p, [`secondary:${slot}`]: treeId }));
  }

  function pickEnchant(type: SelectionType, slot: number, opt: EnchOpt) {
    if (!build) return;
    const check = canPick(rows, byId, type, slot, opt);
    if (!check.ok) {
      toast.info(check.reason);
      return;
    }
    const existing = rowAt(type, slot);
    const key = type === "primary" ? "primary" : `secondary:${slot}`;
    const clearPending = () => setPending((p) => (type === "primary" ? p : Object.fromEntries(Object.entries(p).filter(([k]) => k !== key))));
    const job = existing
      ? run(() => db.from("item_build_enchantments").update({ enchantment_id: opt.id }).eq("id", existing.id), "เปลี่ยนพลังแฝงแล้ว")
      : run(
          () => db.from("item_build_enchantments").insert({ build_id: build.id, enchantment_id: opt.id, selection_type: type, sort_order: slot }),
          "เพิ่มพลังแฝงแล้ว"
        );
    void job.then((done) => done && clearPending());
  }

  function removeAt(type: SelectionType, slot: number) {
    const existing = rowAt(type, slot);
    if (!existing) return;
    const check = canRemove(rows, byId, type, slot);
    if (!check.ok) {
      toast.info(check.reason);
      return;
    }
    void run(() => db.from("item_build_enchantments").delete().eq("id", existing.id), "เอาพลังแฝงออกแล้ว");
  }

  async function clearGroup(type: SelectionType) {
    if (!build) return;
    const label = type === "primary" ? "สายหลัก" : "สายรอง";
    const yes = await confirmDialog({ title: `ล้างพลังแฝง${label}?`, message: "พลังแฝงทั้งหมดของสายนี้ในบิลด์นี้จะถูกเอาออก", confirmLabel: "ล้าง", danger: true });
    if (!yes) return;
    const done = await run(() => db.from("item_build_enchantments").delete().eq("build_id", build.id).eq("selection_type", type), `ล้าง${label}แล้ว`);
    if (done) setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => (type === "primary" ? k !== "primary" : !k.startsWith("secondary:")))));
  }

  function onNodeClick(type: SelectionType, slot: number, align: Align) {
    const tree = type === "primary" ? primaryTreeId : secondaryTreeId(slot);
    const avail = slotAvailable(rows, byId, type, slot);
    if (!avail.ok) {
      toast.info(avail.reason);
      return;
    }
    const same = open && open.type === type && open.slot === slot && open.kind === (tree ? "node" : "tree");
    setOpen(same ? null : { kind: tree ? "node" : "tree", type, slot, align });
  }

  function onTreeClick(type: SelectionType, slot: number, align: Align) {
    const avail = slotAvailable(rows, byId, type, slot);
    if (!avail.ok) {
      toast.info(avail.reason);
      return;
    }
    const same = open && open.type === type && open.slot === slot && open.kind === "tree";
    setOpen(same ? null : { kind: "tree", type, slot, align });
  }

  const POP_ALIGN: Record<Align, string> = { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" };

  // ป๊อปอัปใต้แถว: เลือกสี (ไอคอนสีของสาย) หรือเลือกพลังแฝงของสีนั้น
  const popover = (type: SelectionType): ReactNode => {
    if (!open || open.type !== type) return null;
    const { kind, slot, align } = open;
    let body: ReactNode;
    let title: string;
    if (kind === "tree") {
      title = `เลือกสี · ${type === "primary" ? "สายหลัก" : `สายรอง ช่อง ${slot}`}`;
      const choices = treeChoices(rows, byId, treeIds, type, slot);
      const current = type === "primary" ? primaryTreeId : secondaryTreeId(slot);
      body = choices.map(({ treeId, check }) => {
        const t = treeById.get(treeId);
        return (
          <button
            key={treeId}
            type="button"
            aria-disabled={!check.ok}
            disabled={busy}
            title={check.ok ? t?.name_th : check.reason}
            onClick={() => void chooseTree(type, slot, treeId)}
            className={`flex w-[72px] flex-col items-center gap-1 rounded-lg p-1.5 text-center transition hover:bg-bg-raised ${check.ok ? "" : "opacity-35"} ${
              treeId === current ? "bg-bg-raised ring-2 ring-accent" : ""
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[50%] border-2 bg-black/20" style={{ borderColor: hexOf(treeId) }}>
              <TreeGlyph tree={t ?? null} />
            </span>
            <span className="w-full truncate text-[10px] leading-tight">{t?.name_th ?? "?"}</span>
          </button>
        );
      });
    } else {
      const tree = type === "primary" ? primaryTreeId : secondaryTreeId(slot);
      const tier = tree ? requiredTier(rows, byId, type, slot, tree) : null;
      title = `เลือกพลังแฝง · ${treeOf(tree)?.name_th ?? ""} · Tier ${tier ? ROMAN[tier] : "?"}`;
      const list = tree ? pickerOptions(rows, byId, options, type, slot, tree) : [];
      const currentId = rowAt(type, slot)?.enchantment_id;
      body = (
        <>
          {list.map(({ opt, check }) => (
            <button
              key={opt.id}
              type="button"
              aria-disabled={!check.ok}
              disabled={busy}
              title={check.ok ? opt.name : check.reason}
              onClick={() => (opt.id === currentId ? setOpen(null) : pickEnchant(type, slot, opt))}
              className={`flex w-[84px] flex-col items-center gap-1 rounded-lg p-1.5 text-center transition hover:bg-bg-raised ${check.ok ? "" : "opacity-35"} ${
                opt.id === currentId ? "bg-bg-raised ring-2 ring-accent" : ""
              }`}
            >
              <Thumb src={opt.icon} label={opt.name} bare className="h-12 w-12" />
              <span className="w-full truncate text-[10px] font-medium leading-tight">{opt.name}</span>
              <span className="w-full truncate text-[10px] leading-tight text-text-faint">{opt.nameTh}</span>
            </button>
          ))}
          {list.length === 0 && <p className="px-3 py-4 text-sm text-text-muted">ไม่มีพลังแฝงที่เลือกได้ในช่องนี้</p>}
          {currentId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => removeAt(type, slot)}
              className="flex w-[72px] flex-col items-center gap-1 rounded-lg p-1.5 text-center text-loss transition hover:bg-loss/10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[50%] border-2 border-loss/50">
                <X className="h-5 w-5" />
              </span>
              <span className="text-[10px] leading-tight">เอาออก</span>
            </button>
          )}
        </>
      );
    }
    return (
      <div className={`absolute top-full z-30 mt-2 w-max max-w-[calc(100vw-2.5rem)] rounded-card border border-border bg-bg-surface p-2 shadow-card ${POP_ALIGN[align]}`}>
        <div className="mb-1 flex items-center justify-between gap-3 px-1">
          <p className="text-[11px] font-medium text-text-muted">{title}</p>
          <button type="button" onClick={() => setOpen(null)} aria-label="ปิด" className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-bg-raised">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-1">{body}</div>
      </div>
    );
  };

  const groupHead = (title: string, hint: string, type: SelectionType) => (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-text-faint">{hint}</p>
      </div>
      <button
        type="button"
        disabled={busy || !rows.some((r) => r.selection_type === type)}
        onClick={() => void clearGroup(type)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-bg-raised px-3 text-xs text-text-muted hover:border-loss/50 hover:text-loss disabled:pointer-events-none disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        ล้าง
      </button>
    </div>
  );

  const isOpen = (type: SelectionType, slot: number, kind?: Pop["kind"]) => !!open && open.type === type && open.slot === slot && (!kind || open.kind === kind);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-base font-semibold">พลังแฝงในบิลด์</h2>

      <BuildPicker persistKey="admin:buildEnchant" reloadKey={0} onBuild={onBuild} />

      {build && (
        <section className="space-y-5 rounded-card border border-border bg-bg-surface p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-text-muted">
            {heroName} · แพตช์ {build.patchCode}
            {(loadingRows || busy) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </p>

          <div ref={boardRef} className="space-y-6">
            {/* สายหลัก: ไอคอนสี → I → II → III */}
            <div className="space-y-2">
              {groupHead("สายหลัก", "เลือกได้ถึง Tier III · ทุกโหนดต้องเป็นสีเดียวกัน", "primary")}
              <div className="relative">
                <div className="flex items-center">
                  <TreeButton
                    tree={treeOf(primaryTreeId)}
                    active={isOpen("primary", 1, "tree")}
                    label="เลือกสีสายหลัก"
                    onClick={() => onTreeClick("primary", 1, "start")}
                  />
                  {[1, 2, 3].map((tier) => (
                    <div key={tier} className="flex min-w-0 flex-1 items-center">
                      <Line hex={hexOf(primaryTreeId)} dim={!optAt("primary", tier)} />
                      <NodeButton
                        opt={optAt("primary", tier)}
                        tier={tier}
                        diamond={tier === 3}
                        hex={hexOf(primaryTreeId)}
                        active={isOpen("primary", tier, "node")}
                        label={`พลังแฝงสายหลัก Tier ${ROMAN[tier]}`}
                        onClick={() => onNodeClick("primary", tier, tier === 1 ? "start" : tier === 2 ? "center" : "end")}
                      />
                    </div>
                  ))}
                </div>
                {popover("primary")}
              </div>
            </div>

            {/* สายรอง: 2 ช่อง แต่ละช่องมีไอคอนสีของตัวเอง */}
            <div className="space-y-2">
              {groupHead("สายรอง", "ห้ามสีเดียวกับสายหลัก · ช่อง 2 คนละสีกับช่อง 1 = Tier I, สีเดียวกับช่อง 1 = Tier II", "secondary")}
              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2].map((slot) => {
                    const tid = secondaryTreeId(slot);
                    const tier = optAt("secondary", slot)?.tier ?? (tid ? requiredTier(rows, byId, "secondary", slot, tid) : 1) ?? 1;
                    const locked = !slotAvailable(rows, byId, "secondary", slot).ok;
                    return (
                      <div key={slot} className="flex items-center">
                        <TreeButton
                          tree={treeOf(tid)}
                          active={isOpen("secondary", slot, "tree")}
                          label={`เลือกสีสายรอง ช่อง ${slot}`}
                          onClick={() => onTreeClick("secondary", slot, slot === 1 ? "start" : "end")}
                        />
                        <Line hex={hexOf(tid)} dim={!optAt("secondary", slot)} />
                        <NodeButton
                          opt={optAt("secondary", slot)}
                          tier={tier}
                          hex={hexOf(tid)}
                          locked={locked}
                          active={isOpen("secondary", slot, "node")}
                          label={`พลังแฝงสายรอง ช่อง ${slot}`}
                          onClick={() => onNodeClick("secondary", slot, slot === 1 ? "start" : "end")}
                        />
                      </div>
                    );
                  })}
                </div>
                {popover("secondary")}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-text-faint">แตะไอคอนสีเพื่อเลือกสี แล้วแตะโหนดเพื่อเลือกพลังแฝง · จุดสีทองบนโหนด = รอตรวจสอบกับเกมจริง</p>

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
        </section>
      )}
      <ConfirmHost />
    </div>
  );
}
