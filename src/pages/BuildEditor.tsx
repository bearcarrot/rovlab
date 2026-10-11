import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Hammer, Loader2, Plus, Search, X } from "lucide-react";
import { getHeroes } from "@/services/heroes";
import {
  getCatalogEnchantments, getCatalogItems, getCatalogRunes, getCatalogSpells,
  type CatalogEnchantment, type CatalogItem, type CatalogRune, type CatalogSpell, type EnchantmentTree,
} from "@/services/gameCatalog";
import { buildError, getBuild, saveBuild } from "@/services/userBuilds";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { ItemSlots, RuneSlots, type RowMove } from "@/features/admin/BuildSlots";
import { Thumb, type ImgOpt } from "@/features/admin/ImageSelect";
import { PHASES, RUNE_COLOR_VIEW } from "@/features/build/buildView";

// ตัวสร้าง/แก้ไข "Build ของฉัน": ใช้สล็อตไอเทม/รูนแบบเดียวกับฝั่งแอดมิน (ลากวางได้) และเลือกได้เฉพาะรายการที่ยืนยันกับเกมแล้ว
// บันทึกผ่าน RPC save_user_build (ตรวจซ้ำที่ฐานข้อมูลและกรองคำไม่เหมาะสมที่ชื่อ/โน๊ต)

type ItemRow = { id: string; item_id: string; phase: string; sort_order: number };
type RuneRow = { id: string; rune_id: string; quantity: number; sort_order: number };
type EnchSlot = { key: string; enchantment_id: string; selection_type: "primary" | "secondary" };
type RuneOpt = ImgOpt & { color?: string };
type Panel = null | "spell" | "primary" | "secondary";
type Catalog = [CatalogItem[], CatalogRune[], CatalogSpell[], { trees: EnchantmentTree[]; list: CatalogEnchantment[] }];

const EMPTY_CATALOG: Catalog = [[], [], [], { trees: [], list: [] }];
const MAX_ITEMS = 12;
const MAX_ENCHANTMENTS = 12;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const squash = (s: string) => s.toLowerCase().replace(/[\s'’`"\-_.]/g, "");
const nextOrder = (rows: { sort_order: number }[]) => rows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;

const ctl = "block w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition placeholder:text-text-faint focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const btn = "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

function PickPanel({ title, options, round, disabled, onPick, onClose }: { title: string; options: ImgOpt[]; round?: boolean; disabled: Set<string>; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = squash(q);
    return n ? options.filter((o) => squash(`${o.label} ${o.alt ?? ""}`).includes(n)) : options;
  }, [options, q]);
  return (
    <div className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">{title}</p>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-raised" aria-label="ปิด">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา..." className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm" />
      </div>
      <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8">
        {list.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={disabled.has(o.id)}
            onClick={() => onPick(o.id)}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg p-1.5 text-center hover:border-accent/40 disabled:opacity-40"
          >
            <Thumb src={o.icon} label={o.label} round={round} className="h-9 w-9" />
            <span className="w-full truncate text-[10px] leading-tight">{o.label}</span>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full py-4 text-center text-sm text-text-muted">ไม่พบรายการ</p>}
      </div>
    </div>
  );
}

export function BuildEditor() {
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const catalog = useAsync(() => Promise.all([getCatalogItems(), getCatalogRunes(), getCatalogSpells(), getCatalogEnchantments()]), []);
  const heroesQ = useAsync(() => getHeroes(), []);
  const existing = useAsync(() => (isNew ? Promise.resolve(null) : getBuild(id)), [id]);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [spellId, setSpellId] = useState("");
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [runeRows, setRuneRows] = useState<RuneRow[]>([]);
  const [ench, setEnch] = useState<EnchSlot[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(isNew);

  useEffect(() => {
    if (hydrated || existing.status !== "success" || !existing.data) return;
    const b = existing.data;
    setName(b.name);
    setNote(b.note);
    setIsPublic(b.isPublic);
    setSpellId(b.spellId ?? "");
    setItemRows(b.ids.items.map((x, i) => ({ id: uid(), item_id: x.itemId, phase: x.phase, sort_order: i + 1 })));
    setRuneRows(b.ids.runes.map((x, i) => ({ id: uid(), rune_id: x.runeId, quantity: x.quantity, sort_order: i + 1 })));
    setEnch(b.ids.enchants.map((x) => ({ key: uid(), enchantment_id: x.id, selection_type: x.type })));
    setHydrated(true);
  }, [existing, hydrated]);

  const [items, runes, spells, enchData] = catalog.status === "success" ? catalog.data : EMPTY_CATALOG;
  const itemOpts: ImgOpt[] = useMemo(() => items.map((i) => ({ id: i.id, label: i.name, icon: i.icon || undefined, alt: i.nameTh })), [items]);
  const runeOpts: RuneOpt[] = useMemo(() => runes.map((r) => ({ id: r.id, label: r.name, icon: r.icon || undefined, color: r.color ?? undefined })), [runes]);
  const spellOpts: ImgOpt[] = useMemo(() => spells.map((s) => ({ id: s.id, label: s.nameTh, icon: s.icon || undefined, alt: s.name })), [spells]);
  const enchOpts: ImgOpt[] = useMemo(() => enchData.list.map((e) => ({ id: e.id, label: e.nameTh, icon: e.icon || undefined, alt: e.name })), [enchData]);
  const enchById = useMemo(() => new Map(enchOpts.map((o) => [o.id, o])), [enchOpts]);
  const spell = spellOpts.find((s) => s.id === spellId);
  const colorOf = (runeId: string) => runeOpts.find((r) => r.id === runeId)?.color;

  const hero = isNew
    ? heroesQ.status === "success"
      ? (() => {
          const h = heroesQ.data.find((x) => x.slug === params.get("hero"));
          return h ? { id: h.id, nameTh: h.nameTh, icon: h.icon } : null;
        })()
      : null
    : existing.status === "success" && existing.data
      ? { id: existing.data.hero.id, nameTh: existing.data.hero.nameTh, icon: existing.data.hero.icon }
      : null;

  useDocumentMeta({
    title: isNew ? "สร้างบิลด์ | RoV LAB" : "แก้ไขบิลด์ | RoV LAB",
    description: "สร้างและแก้ไขบิลด์ของคุณ",
    path: "/build",
    breadcrumbs: [{ name: "หน้าแรก", path: "/" }, { name: "Item Build", path: "/build" }],
  });

  if (catalog.status === "loading" || heroesQ.status === "loading" || existing.status === "loading") return <Skeleton className="h-64" />;
  if (catalog.status === "error") return <ErrorState message={catalog.message} onRetry={catalog.refetch} />;
  if (heroesQ.status === "error") return <ErrorState message={heroesQ.message} onRetry={heroesQ.refetch} />;
  if (existing.status === "error") return <ErrorState message={existing.message} onRetry={existing.refetch} />;
  if (!isNew && (existing.status !== "success" || !existing.data || (user && existing.data.ownerId !== user.id))) {
    return <EmptyState icon={Hammer} title="ไม่พบบิลด์นี้" description="อาจถูกลบแล้ว หรือไม่ใช่บิลด์ของคุณ" />;
  }
  if (!hero) {
    return (
      <div className="space-y-3">
        <EmptyState icon={Hammer} title="ยังไม่ได้เลือกฮีโร่" description="กลับไปเลือกฮีโร่แล้วกดสร้างบิลด์" />
        <Link to="/build?tab=mine" className="block text-center text-sm text-accent">กลับไป Item Build →</Link>
      </div>
    );
  }

  // ให้ array เรียงตาม sort_order เสมอ (planItemMove/planRuneMove อ่านลำดับจากตำแหน่งใน array)
  const applyMoves = <T extends { id: string; sort_order: number }>(rows: T[], moves: RowMove[]) =>
    rows
      .map((r) => {
        const m = moves.find((x) => x.id === r.id);
        return m ? ({ ...r, ...m.patch } as T) : r;
      })
      .sort((a, b) => a.sort_order - b.sort_order);

  function addItem(itemId: string, phase: string) {
    if (itemRows.some((r) => r.item_id === itemId)) return toast.error("ไอเทมนี้อยู่ในบิลด์แล้ว");
    if (itemRows.length >= MAX_ITEMS) return toast.error(`ใส่ไอเทมได้สูงสุด ${MAX_ITEMS} ชิ้น`);
    setItemRows((rows) => [...rows, { id: uid(), item_id: itemId, phase, sort_order: nextOrder(rows) }]);
  }

  function addRune(runeId: string) {
    const color = colorOf(runeId);
    const used = runeRows.filter((r) => colorOf(r.rune_id) === color).reduce((n, r) => n + r.quantity, 0);
    if (used >= 10) return toast.error("รูนแต่ละสีใส่ได้สูงสุด 10 ช่อง");
    setRuneRows((rows) => {
      const hit = rows.find((r) => r.rune_id === runeId);
      if (hit) return rows.map((r) => (r === hit ? { ...r, quantity: r.quantity + 1 } : r));
      return [...rows, { id: uid(), rune_id: runeId, quantity: 1, sort_order: nextOrder(rows) }];
    });
  }

  function pickEnch(type: "primary" | "secondary", enchId: string) {
    if (ench.some((e) => e.enchantment_id === enchId)) return toast.error("พลังแฝงนี้อยู่ในบิลด์แล้ว");
    if (ench.length >= MAX_ENCHANTMENTS) return toast.error(`ใส่พลังแฝงได้สูงสุด ${MAX_ENCHANTMENTS} รายการ`);
    setEnch((xs) => [...xs, { key: uid(), enchantment_id: enchId, selection_type: type }]);
  }

  async function save() {
    if (!name.trim()) return toast.error("ต้องตั้งชื่อบิลด์");
    if (itemRows.length === 0) return toast.error("เพิ่มไอเทมอย่างน้อย 1 ชิ้น");
    setBusy(true);
    try {
      const newId = await saveBuild({
        id: isNew ? null : id,
        heroId: hero!.id,
        name: name.trim(),
        note,
        spellId: spellId || null,
        isPublic,
        items: PHASES.flatMap((p) => itemRows.filter((r) => r.phase === p.k).sort((a, b) => a.sort_order - b.sort_order).map((r) => ({ item_id: r.item_id, phase: p.k }))),
        runes: [...runeRows].sort((a, b) => a.sort_order - b.sort_order).map((r) => ({ rune_id: r.rune_id, quantity: r.quantity })),
        enchantments: ench.map((e) => ({ enchantment_id: e.enchantment_id, selection_type: e.selection_type })),
      });
      toast.success("บันทึกแล้ว");
      navigate(`/build/view/${newId}`);
    } catch (e) {
      toast.error(buildError(e));
    } finally {
      setBusy(false);
    }
  }

  const takenEnch = new Set(ench.map((e) => e.enchantment_id));
  const enchGroup = (type: "primary" | "secondary", label: string) => (
    <div>
      <p className="mb-2 text-xs font-medium text-text-faint">{label}</p>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
        {ench.filter((e) => e.selection_type === type).map((e) => {
          const o = enchById.get(e.enchantment_id);
          return (
            <div key={e.key} className="relative">
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-bg-surface text-center">
                <Thumb src={o?.icon} label={o?.label ?? "?"} className="h-10 w-10" />
                <span className="max-w-full truncate px-1 text-[10px] font-medium leading-tight">{o?.label ?? "?"}</span>
              </div>
              <button type="button" aria-label="ลบพลังแฝง" onClick={() => setEnch((xs) => xs.filter((x) => x.key !== e.key))} className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-loss text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button type="button" aria-label={`เพิ่มพลังแฝง${label}`} onClick={() => setPanel(panel === type ? null : type)} className={`flex aspect-square items-center justify-center rounded-lg border border-dashed ${panel === type ? "border-accent bg-accent/10" : "border-border bg-bg-surface"}`}>
          <Plus className="h-4 w-4 text-text-faint" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Thumb src={hero.icon || undefined} label={hero.nameTh} className="h-12 w-12" />
        <div>
          <h1 className="font-display text-xl font-semibold">{isNew ? "สร้างบิลด์" : "แก้ไขบิลด์"}: {hero.nameTh}</h1>
          <p className="text-xs text-text-faint">เลือกได้เฉพาะรายการที่ยืนยันกับเกมแล้วเท่านั้น</p>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">ชื่อบิลด์</span>
          <input className={`${ctl} h-11`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="เช่น สายดาเมจเน้นคริ" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-text-muted">โน๊ต (ไม่บังคับ)</span>
          <textarea className={`${ctl} min-h-[88px] resize-y py-2.5`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="อธิบายแนวคิดหรือจังหวะซื้อไอเทม" />
        </label>
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">ไอเทม</h2>
        <ItemSlots
          rows={itemRows}
          items={itemOpts}
          onAdd={addItem}
          onRemove={(r) => setItemRows((rows) => rows.filter((x) => x.id !== r.id))}
          onOpen={() => undefined}
          onMoves={(m) => setItemRows((rows) => applyMoves(rows, m))}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">รูน</h2>
        <RuneSlots
          rows={runeRows}
          rune={runeOpts}
          colors={RUNE_COLOR_VIEW}
          max={10}
          onAdd={addRune}
          onDec={(r) => setRuneRows((rows) => (r.quantity <= 1 ? rows.filter((x) => x.id !== r.id) : rows.map((x) => (x.id === r.id ? { ...x, quantity: x.quantity - 1 } : x))))}
          onMoves={(m) => setRuneRows((rows) => applyMoves(rows, m))}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">สกิลชาเลนเจอร์</h2>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="เลือกสกิลชาเลนเจอร์" onClick={() => setPanel(panel === "spell" ? null : "spell")} className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-[50%] border ${spell ? "border-border" : "border-dashed border-border"} ${panel === "spell" ? "ring-2 ring-accent" : ""} bg-bg-surface`}>
            {spell ? <Thumb src={spell.icon} label={spell.label} round className="h-full w-full" /> : <Plus className="h-4 w-4 text-text-faint" />}
          </button>
          <div className="min-w-0 flex-1 text-sm">
            {spell ? <span className="font-medium">{spell.label}</span> : <span className="text-text-faint">ยังไม่ได้เลือก</span>}
          </div>
          {spell && <button type="button" className="text-xs text-text-muted underline" onClick={() => setSpellId("")}>ล้าง</button>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">พลังแฝง</h2>
        {enchGroup("primary", "หลัก")}
        {enchGroup("secondary", "รอง")}
      </section>

      {panel === "spell" && <PickPanel title="เลือกสกิลชาเลนเจอร์" options={spellOpts} round disabled={new Set()} onPick={(sid) => { setSpellId(sid); setPanel(null); }} onClose={() => setPanel(null)} />}
      {(panel === "primary" || panel === "secondary") && (
        <PickPanel title={`เลือกพลังแฝง · ${panel === "primary" ? "หลัก" : "รอง"}`} options={enchOpts} disabled={takenEnch} onPick={(eid) => pickEnch(panel, eid)} onClose={() => setPanel(null)} />
      )}

      <section className="space-y-2 rounded-card border border-border bg-bg-surface p-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#E8A33D]" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          <span className="text-sm">
            <span className="font-medium">เผยแพร่เป็น Community Build</span>
            <span className="block text-xs text-text-muted">คนอื่นเห็นชื่อบิลด์ โน๊ต และชื่อผู้สร้าง ชื่อและโน๊ตถูกตรวจคำไม่เหมาะสม และแอดมินซ่อนบิลด์ได้หากฝ่าฝืนกฎชุมชน</span>
          </span>
        </label>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link to="/build?tab=mine" className={`${btn} border border-border bg-bg-raised text-text`}>ยกเลิก</Link>
        <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} bg-accent text-accent-fg hover:brightness-110`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}บันทึกบิลด์
        </button>
      </div>
    </div>
  );
}
