import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Hammer, Loader2 } from "lucide-react";
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
import { ITEM_TYPE_CHOICES, PHASES, RUNE_COLOR_VIEW } from "@/features/build/buildView";
import { EnchantmentBoard, type BoardRow, type EnchTree } from "@/features/build/EnchantmentBoard";
import { SpellPicker, type SpellOpt } from "@/features/build/SpellPicker";
import type { EnchOpt, SelectionType } from "@/lib/enchantmentRules";

// ตัวสร้าง/แก้ไข "Build ของฉัน": ใช้ตัวแก้ไขชุดเดียวกับฝั่งแอดมิน — สล็อตไอเทม/รูน (ลากวางได้), กระดานพลังแฝง, ตัวเลือกสกิลชาเลนเจอร์ —
// และเลือกได้เฉพาะรายการที่ยืนยันกับเกมแล้ว ต่างกันที่การเก็บข้อมูล: แอดมินเขียน DB ทันที ส่วนที่นี่เก็บใน state จนกดบันทึก
// บันทึกผ่าน RPC save_user_build (ตรวจซ้ำที่ฐานข้อมูลและกรองคำไม่เหมาะสมที่ชื่อ/โน๊ต) สิทธิ์ทั้งหมดบังคับที่ RLS/RPC ไม่ใช่ที่ฝั่งหน้าจอ

type ItemRow = { id: string; item_id: string; phase: string; sort_order: number };
type RuneRow = { id: string; rune_id: string; quantity: number; sort_order: number };
type RuneOpt = ImgOpt & { color?: string };
type Catalog = [CatalogItem[], CatalogRune[], CatalogSpell[], { trees: EnchantmentTree[]; list: CatalogEnchantment[] }];

const EMPTY_CATALOG: Catalog = [[], [], [], { trees: [], list: [] }];
const MAX_ITEMS = 12;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const nextOrder = (rows: { sort_order: number }[]) => rows.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;

// บิลด์ที่บันทึกไว้เก็บพลังแฝงเป็นลำดับในสาย (ไม่เก็บหมายเลขช่อง) จึงคืนช่องจากกติกาของเกม:
// สายหลักช่อง n = พลังแฝง Tier n, สายรองเรียงตามลำดับที่บันทึก (ช่อง 1, 2)
function toBoardRows(saved: { id: string; type: SelectionType }[], tierOf: Map<string, number | null>): BoardRow[] {
  const rows: BoardRow[] = [];
  let primary = 0;
  let secondary = 0;
  for (const e of saved) {
    if (e.type === "primary") {
      primary += 1;
      rows.push({ id: uid(), enchantment_id: e.id, selection_type: "primary", sort_order: tierOf.get(e.id) ?? primary });
    } else {
      secondary += 1;
      rows.push({ id: uid(), enchantment_id: e.id, selection_type: "secondary", sort_order: secondary });
    }
  }
  return rows;
}

const ctl = "block w-full rounded-lg border border-border bg-bg-raised px-3 text-base text-text outline-none transition placeholder:text-text-faint focus:border-accent focus:ring-1 focus:ring-accent sm:text-sm";
const btn = "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

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
  const [enchRows, setEnchRows] = useState<BoardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(isNew);

  // รอแคตตาล็อกโหลดก่อน เพราะต้องใช้ Tier ของพลังแฝงเพื่อคืนช่องในกระดาน
  useEffect(() => {
    if (hydrated || existing.status !== "success" || !existing.data || catalog.status !== "success") return;
    const b = existing.data;
    setName(b.name);
    setNote(b.note);
    setIsPublic(b.isPublic);
    setSpellId(b.spellId ?? "");
    setItemRows(b.ids.items.map((x, i) => ({ id: uid(), item_id: x.itemId, phase: x.phase, sort_order: i + 1 })));
    setRuneRows(b.ids.runes.map((x, i) => ({ id: uid(), rune_id: x.runeId, quantity: x.quantity, sort_order: i + 1 })));
    setEnchRows(toBoardRows(b.ids.enchants, new Map(catalog.data[3].list.map((e) => [e.id, e.tier]))));
    setHydrated(true);
  }, [existing, catalog, hydrated]);

  const [items, runes, spells, enchData] = catalog.status === "success" ? catalog.data : EMPTY_CATALOG;
  const itemOpts: ImgOpt[] = useMemo(() => items.map((i) => ({ id: i.id, label: i.name, icon: i.icon || undefined, alt: i.nameTh })), [items]);
  const runeOpts: RuneOpt[] = useMemo(() => runes.map((r) => ({ id: r.id, label: r.name, icon: r.icon || undefined, color: r.color ?? undefined })), [runes]);
  const spellOpts: SpellOpt[] = useMemo(
    () => spells.map((s) => ({ id: s.id, name: s.name, nameTh: s.nameTh, description: s.description, cooldownSeconds: s.cooldownSeconds, icon: s.icon || undefined, pickable: true })),
    [spells]
  );
  const enchTrees: EnchTree[] = useMemo(() => enchData.trees.map((t) => ({ id: t.id, slug: t.slug, name: t.name, icon_url: t.icon || null })), [enchData]);
  // แคตตาล็อกสาธารณะมีเฉพาะที่ยืนยันกับเกมแล้วและใช้งานอยู่ (active / seasonal) จึงเลือกได้ทั้งหมด
  const enchRuleOpts: EnchOpt[] = useMemo(
    () => enchData.list.map((e) => ({ id: e.id, name: e.name, nameTh: e.nameTh, treeId: e.treeId, tier: e.tier, status: e.status, icon: e.icon || undefined, verified: true })),
    [enchData]
  );
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

  // เติมรูนเดียวกันหลายช่องทีเดียว (ลากจากกริด / โหมดแตะเติมเต็ม) ไม่เกิน 10 ช่องต่อสี เหมือนฝั่งแอดมิน
  function fillRune(runeId: string, count: number) {
    const color = colorOf(runeId);
    const used = runeRows.filter((r) => colorOf(r.rune_id) === color).reduce((n, r) => n + r.quantity, 0);
    const n = Math.min(count, 10 - used);
    if (n <= 0) return toast.error("รูนแต่ละสีใส่ได้สูงสุด 10 ช่อง");
    setRuneRows((rows) => {
      const hit = rows.find((r) => r.rune_id === runeId);
      if (hit) return rows.map((r) => (r === hit ? { ...r, quantity: r.quantity + n } : r));
      return [...rows, { id: uid(), rune_id: runeId, quantity: n, sort_order: nextOrder(rows) }];
    });
  }

  // กระดานพลังแฝง: เก็บใน state (ไม่เขียน DB จนกดบันทึกบิลด์) กติกาการเลือกตรวจในตัวกระดานเอง
  const enchPick = async (type: SelectionType, slot: number, opt: EnchOpt, existingRow: BoardRow | undefined) => {
    setEnchRows((rows) =>
      existingRow
        ? rows.map((r) => (r.id === existingRow.id ? { ...r, enchantment_id: opt.id } : r))
        : [...rows, { id: uid(), enchantment_id: opt.id, selection_type: type, sort_order: slot }]
    );
    return true;
  };
  const enchRemove = async (row: BoardRow) => {
    setEnchRows((rows) => rows.filter((r) => r.id !== row.id));
    return true;
  };
  const enchClear = async (type: SelectionType) => {
    setEnchRows((rows) => rows.filter((r) => r.selection_type !== type));
    return true;
  };

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
        // RPC เก็บลำดับในสายตามลำดับของ array จึงส่งสายหลักก่อน แล้วเรียงตามช่อง (Tier I → III / ช่อง 1 → 2)
        enchantments: [...enchRows]
          .sort((a, b) => (a.selection_type === b.selection_type ? a.sort_order - b.sort_order : a.selection_type === "primary" ? -1 : 1))
          .map((r) => ({ enchantment_id: r.enchantment_id, selection_type: r.selection_type })),
      });
      toast.success("บันทึกแล้ว");
      navigate(`/build/view/${newId}`);
    } catch (e) {
      toast.error(buildError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-24">
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
          typeChoices={ITEM_TYPE_CHOICES}
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
          onFill={fillRune}
          onDec={(r) => setRuneRows((rows) => (r.quantity <= 1 ? rows.filter((x) => x.id !== r.id) : rows.map((x) => (x.id === r.id ? { ...x, quantity: x.quantity - 1 } : x))))}
          onMoves={(m) => setRuneRows((rows) => applyMoves(rows, m))}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">สกิลชาเลนเจอร์</h2>
        <div className="rounded-card border border-border bg-bg-surface p-3 sm:p-4">
          <SpellPicker spells={spellOpts} value={spellId || null} onChange={(sid) => setSpellId(sid ?? "")} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">พลังแฝง</h2>
        <EnchantmentBoard
          trees={enchTrees}
          options={enchRuleOpts}
          rows={enchRows}
          resetKey={isNew ? "new" : id}
          onPick={enchPick}
          onRemove={enchRemove}
          onClearType={enchClear}
        />
      </section>

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
