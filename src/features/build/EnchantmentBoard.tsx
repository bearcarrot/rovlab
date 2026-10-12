import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Gem, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ConfirmHost, confirmDialog } from "@/features/community/confirm";
import { Thumb } from "@/features/admin/ImageSelect";
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

// กระดานเลือกพลังแฝงของบิลด์ (หน้าตาเลียนแบบหน้าพลังแฝงในเกม) — ส่วนแสดงผลและการตรวจกติกา ใช้ร่วมกันทั้งแอดมินและตัวสร้างบิลด์ของผู้ใช้
//   สายหลัก = ไอคอนสี → โหนด I → II → III (ช่อง n = Tier n)   สายรอง = 2 ช่อง แต่ละช่องมีไอคอนสีของตัวเอง
// กติกาอยู่ที่ src/lib/enchantmentRules.ts ไฟล์นี้ไม่แตะ Supabase และไม่ตรวจสิทธิ์:
// ผู้เรียกส่งแถวปัจจุบัน (rows) เข้ามา และเป็นคนเขียนข้อมูลจริงผ่าน onPick / onRemove / onClearType (แอดมิน = เขียน DB, ผู้ใช้ = เก็บใน state)

export type EnchTree = { id: string; slug: string; name: string; icon_url: string | null };
export type BoardRow = SelRow & { id: string };

type Align = "start" | "center" | "end";
type Pop = { kind: "tree" | "node"; type: SelectionType; slot: number; align: Align };

// สีประจำสาย (ใช้แต่งเส้น/ขอบ/ไอคอนสีให้เหมือนในเกมเท่านั้น ไม่มีผลกับกติกา) — สายที่ไม่รู้จักใช้สีเทา
const TREE_HEX: Record<string, string> = { lokheim: "#ef4444", veda: "#eab308", afata: "#22c55e", "league-of-humans": "#3b82f6" };
const NEUTRAL = "#64748b";
const ROMAN = ["", "I", "II", "III"];

// ไอคอนสี (สาย): มีรูปใช้รูป ไม่มีใช้เพชรสีประจำสาย
function TreeGlyph({ tree, size = 28 }: { tree: EnchTree | null; size?: number }) {
  if (tree?.icon_url) return <Thumb src={tree.icon_url} label={tree.name} bare className="h-full w-full" />;
  return <Gem style={{ width: size, height: size, color: tree ? TREE_HEX[tree.slug] ?? NEUTRAL : NEUTRAL }} strokeWidth={1.75} aria-hidden />;
}

// แตะไอคอนสีเพื่อเลือกสีของสาย (วงกลมใหญ่ด้านซ้ายของแถว เหมือนในเกม)
function TreeButton({ tree, active, label, onClick }: { tree: EnchTree | null; active: boolean; label: string; onClick: () => void }) {
  const hex = tree ? TREE_HEX[tree.slug] ?? NEUTRAL : NEUTRAL;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[50%] border-2 bg-black/20 transition hover:brightness-125 sm:h-14 sm:w-14 ${
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
  const icon = opt ? <Thumb src={opt.icon} label={opt.name} bare className="h-7 w-7 sm:h-9 sm:w-9" /> : null;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center transition hover:brightness-125 sm:h-14 sm:w-14 ${locked ? "opacity-40" : ""}`}
    >
      {diamond ? (
        <span
          className={`flex h-8 w-8 rotate-45 items-center justify-center rounded-md border-2 bg-black/20 sm:h-10 sm:w-10 ${active ? "ring-2 ring-accent" : ""}`}
          style={{ borderColor: hex }}
        >
          <span className="-rotate-45">{icon}</span>
        </span>
      ) : (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-[50%] border-2 bg-black/20 sm:h-12 sm:w-12 ${active ? "ring-2 ring-accent" : ""}`}
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

/** ที่มาของการลบ: "tree" = ลบเพราะเปลี่ยนสี (ผู้เรียกใช้เลือกข้อความแจ้งเตือนได้) */
export type RemoveContext = "tree";

export function EnchantmentBoard({
  trees,
  options,
  rows,
  busy = false,
  resetKey,
  header,
  onPick,
  onRemove,
  onClearType,
}: {
  trees: EnchTree[];
  /** พลังแฝงทั้งหมดที่ใช้อ้างอิงได้ (ตัวที่ไม่ active/seasonal จะแสดงได้แต่เลือกใหม่ไม่ได้) */
  options: EnchOpt[];
  rows: BoardRow[];
  /** กำลังบันทึก: ปิดปุ่มทั้งหมดชั่วคราว */
  busy?: boolean;
  /** เปลี่ยนค่า (เช่น id บิลด์) = ทิ้งสีที่เลือกค้างและปิดป๊อปอัป */
  resetKey?: string;
  header?: ReactNode;
  /** ใส่ `opt` ลงช่อง (type, slot): มี existing = แทนที่แถวเดิม ไม่มี = เพิ่มแถวใหม่ คืน true เมื่อสำเร็จ */
  onPick: (type: SelectionType, slot: number, opt: EnchOpt, existing: BoardRow | undefined) => Promise<boolean>;
  onRemove: (row: BoardRow, ctx?: RemoveContext) => Promise<boolean>;
  /** ลบพลังแฝงทั้งสาย (primary / secondary) */
  onClearType: (type: SelectionType, ctx?: RemoveContext) => Promise<boolean>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<Pop | null>(null);
  // สีที่เลือกไว้แล้วแต่ยังไม่ได้เลือกพลังแฝง (ยังไม่มีแถว): คีย์ "primary" หรือ "secondary:<ช่อง>"
  const [pending, setPending] = useState<Record<string, string>>({});
  const boardRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const treeById = useMemo(() => new Map(trees.map((t) => [t.id, t])), [trees]);
  const treeIds = useMemo(() => trees.map((t) => t.id), [trees]);

  const lastReset = useRef(resetKey);
  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    setPending({});
    setOpen(null);
  }, [resetKey]);

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

  async function chooseTree(type: SelectionType, slot: number, treeId: string) {
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
        if (!(await onClearType("primary", "tree"))) return;
      }
      // สีที่เลือกค้างของสายรองที่ซ้ำกับสายหลักใหม่ ต้องเคลียร์ทิ้ง
      setPending((p) => Object.fromEntries(Object.entries({ ...p, primary: treeId }).filter(([k, v]) => k === "primary" || v !== treeId)));
      return;
    }
    if (treeId === secondaryTreeId(slot)) return;
    const existing = rowAt("secondary", slot);
    if (existing && !(await onRemove(existing, "tree"))) return;
    setPending((p) => ({ ...p, [`secondary:${slot}`]: treeId }));
  }

  async function pickEnchant(type: SelectionType, slot: number, opt: EnchOpt) {
    const check = canPick(rows, byId, type, slot, opt);
    if (!check.ok) {
      toast.info(check.reason);
      return;
    }
    const done = await onPick(type, slot, opt, rowAt(type, slot));
    if (!done) return;
    setOpen(null);
    if (type === "secondary") setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== `secondary:${slot}`)));
  }

  async function removeAt(type: SelectionType, slot: number) {
    const existing = rowAt(type, slot);
    if (!existing) return;
    const check = canRemove(rows, byId, type, slot);
    if (!check.ok) {
      toast.info(check.reason);
      return;
    }
    if (await onRemove(existing)) setOpen(null);
  }

  async function clearGroup(type: SelectionType) {
    const label = type === "primary" ? "สายหลัก" : "สายรอง";
    const yes = await confirmDialog({ title: `ล้างพลังแฝง${label}?`, message: "พลังแฝงทั้งหมดของสายนี้ในบิลด์นี้จะถูกเอาออก", confirmLabel: "ล้าง", danger: true });
    if (!yes) return;
    if (!(await onClearType(type))) return;
    setOpen(null);
    setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => (type === "primary" ? k !== "primary" : !k.startsWith("secondary:")))));
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
            title={check.ok ? t?.name : check.reason}
            onClick={() => void chooseTree(type, slot, treeId)}
            className={`flex w-[72px] flex-col items-center gap-1 rounded-lg p-1.5 text-center transition hover:bg-bg-raised ${check.ok ? "" : "opacity-35"} ${
              treeId === current ? "bg-bg-raised ring-2 ring-accent" : ""
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[50%] border-2 bg-black/20" style={{ borderColor: hexOf(treeId) }}>
              <TreeGlyph tree={t ?? null} />
            </span>
            <span className="w-full truncate text-[10px] leading-tight">{t?.name ?? "?"}</span>
          </button>
        );
      });
    } else {
      const tree = type === "primary" ? primaryTreeId : secondaryTreeId(slot);
      const tier = tree ? requiredTier(rows, byId, type, slot, tree) : null;
      title = `เลือกพลังแฝง · ${treeOf(tree)?.name ?? ""} · Tier ${tier ? ROMAN[tier] : "?"}`;
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
              onClick={() => (opt.id === currentId ? setOpen(null) : void pickEnchant(type, slot, opt))}
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
              onClick={() => void removeAt(type, slot)}
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
          <button type="button" onClick={() => setOpen(null)} aria-label="ปิด" className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-bg-raised sm:h-6 sm:w-6">
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
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-bg-raised px-3 text-xs text-text-muted hover:border-loss/50 hover:text-loss disabled:pointer-events-none disabled:opacity-40 sm:h-9"
      >
        <Trash2 className="h-3.5 w-3.5" />
        ล้าง
      </button>
    </div>
  );

  const isOpen = (type: SelectionType, slot: number, kind?: Pop["kind"]) => !!open && open.type === type && open.slot === slot && (!kind || open.kind === kind);

  return (
    <>
      <section className="space-y-5 rounded-card border border-border bg-bg-surface p-3 sm:p-4">
        {header}

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
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
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
      <ConfirmHost />
    </>
  );
}
