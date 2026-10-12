import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Library, Search } from "lucide-react";
import {
  getCatalogEnchantments, getCatalogItems, getCatalogRunes, getCatalogSpells,
  type CatalogEnchantment, type CatalogItem, type CatalogRune, type CatalogSpell, type EnchantmentTree,
} from "@/services/gameCatalog";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Thumb } from "@/features/admin/ImageSelect";
import { catalogPath } from "@/features/build/buildView";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { ITEM_TYPES, RUNE_COLORS } from "@/lib/catalogAdmin";

type Tab = "items" | "runes" | "spells" | "enchantments";
const TABS: [Tab, string][] = [
  ["items", "ไอเทม"],
  ["runes", "รูน"],
  ["spells", "สกิลชาเลนเจอร์"],
  ["enchantments", "พลังแฝง"],
];
// บางแถวเก็บคำอธิบายยาวไว้ใน stats แสดงเฉพาะบรรทัดสั้น
const MAX_STAT_LENGTH = 40;
// ลำดับสีรูนที่แสดง: แดง → ม่วง → เขียว (สีอื่น/ไม่ระบุไปท้ายสุด)
const RUNE_ORDER = ["red", "purple", "green"];
const TIER_OPTS = ["1", "2", "3"].map((n) => ({ value: n, label: `Tier ${n}` }));
const GRID = "grid gap-2 md:grid-cols-2";

const chip = (on: boolean) =>
  `h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm transition ${on ? "border-accent bg-accent font-medium text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"}`;

const match = (q: string, ...vals: (string | undefined)[]) => q === "" || vals.some((v) => (v ?? "").toLowerCase().includes(q));

const tierKey = (t: number | null) => (t == null ? "none" : String(t));

// แบ่งกลุ่มตาม Tier เรียง 1 → 3 (ไม่ระบุ Tier ไว้ท้ายสุด)
function groupByTier<T>(list: T[], tierOf: (x: T) => number | null): { key: string; label: string; rows: T[] }[] {
  const keys = [...new Set(list.map((x) => tierKey(tierOf(x))))].sort((a, b) => (a === "none" ? 1 : b === "none" ? -1 : Number(a) - Number(b)));
  return keys.map((k) => ({ key: k, label: k === "none" ? "ไม่ระบุ Tier" : `Tier ${k}`, rows: list.filter((x) => tierKey(tierOf(x)) === k) }));
}

function Chips<T extends string>({ value, onChange, all, opts }: { value: T | ""; onChange: (v: T | "") => void; all: string; opts: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button type="button" className={chip(value === "")} onClick={() => onChange("")}>{all}</button>
      {opts.map((o) => (
        <button key={o.value} type="button" className={chip(value === o.value)} onClick={() => onChange(value === o.value ? "" : o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// การ์ดทุกใบกดแล้วไปหน้ารายละเอียดของชิ้นนั้น; round = กรอบวงกลม (รูน/สกิลชาเลนเจอร์); bare = ไม่มีพื้นหลัง/ไม่ครอปไอคอน (พลังแฝง)
function Card({ to, icon, title, sub, right, round, bare, children }: { to: string; icon?: string; title: string; sub?: string; right?: React.ReactNode; round?: boolean; bare?: boolean; children?: React.ReactNode }) {
  return (
    <Link to={to} className="flex gap-3 rounded-card border border-border bg-bg-surface p-3 transition hover:border-accent/40">
      <Thumb src={icon || undefined} label={title} round={round} bare={bare} className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-sm font-medium leading-snug">{title}</p>
          {right && <span className="shrink-0 text-xs text-text-faint">{right}</span>}
        </div>
        {sub && <p className="text-xs text-text-faint">{sub}</p>}
        {children}
      </div>
    </Link>
  );
}

function Grid({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) return <EmptyState icon={Library} title="ไม่พบรายการ" description="ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น" />;
  return <div className={GRID}>{children}</div>;
}

function Gold({ cost }: { cost: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <img src="/gold.png" alt="gold" className="h-3.5 w-3.5 object-contain" loading="lazy" />
      {cost.toLocaleString()}
    </span>
  );
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="flex items-baseline gap-2 border-b border-border pb-1.5 font-display text-base font-semibold">
      {label}
      <span className="text-xs font-normal text-text-faint">{count}</span>
    </h2>
  );
}

function TierHeading({ label }: { label: string }) {
  return <h3 className="mb-1.5 text-xs font-medium text-accent">{label}</h3>;
}

function ItemsTab({ q }: { q: string }) {
  const [type, setType] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const d = useAsync(() => getCatalogItems(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const list = d.data
    .filter((i: CatalogItem) => match(q, i.name, i.nameTh, i.slug) && (type === "" || i.roleTags.includes(type)) && (tier === "" || tierKey(i.tier) === tier))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  // แต่ละไอเทมอยู่กลุ่มเดียว: กลุ่มแรกใน ITEM_TYPES ที่ตรงกับ role_tags (ไม่ตรงเลย → "อื่น ๆ")
  const groupOf = (i: CatalogItem) => ITEM_TYPES.find((t) => i.roleTags.includes(t.value))?.value ?? "other";
  const groups = [...ITEM_TYPES, { value: "other", label: "อื่น ๆ" }]
    .map((g) => ({ ...g, rows: list.filter((i) => groupOf(i) === g.value) }))
    .filter((g) => g.rows.length > 0);
  return (
    <div className="space-y-3">
      <Chips value={type} onChange={setType} all="ทุกประเภท" opts={ITEM_TYPES} />
      <Chips value={tier} onChange={setTier} all="ทุก Tier" opts={TIER_OPTS} />
      {groups.length === 0 ? (
        <Grid empty>{null}</Grid>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.value} className="space-y-3">
              <GroupHeading label={g.label} count={g.rows.length} />
              {groupByTier(g.rows, (i) => i.tier).map((t) => (
                <div key={t.key}>
                  <TierHeading label={t.label} />
                  <div className={GRID}>
                    {t.rows.map((i: CatalogItem) => {
                      const stats = i.stats.filter((s) => s.length <= MAX_STAT_LENGTH);
                      return (
                        <Card key={i.id} to={catalogPath("items", i.slug)} icon={i.icon} title={i.name} right={<Gold cost={i.cost} />}>
                          {stats.length > 0 && <p className="mt-1 text-xs text-text-muted">{stats.join(" · ")}</p>}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// รูน: กรอบวงกลม เรียงสี แดง → ม่วง → เขียว ไม่แสดงคำอธิบายในการ์ด (ดูได้ในหน้ารายละเอียด)
function RunesTab({ q }: { q: string }) {
  const [color, setColor] = useState<string>("");
  const d = useAsync(() => getCatalogRunes(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const rank = (c: string | null) => {
    const i = RUNE_ORDER.indexOf(c ?? "");
    return i < 0 ? RUNE_ORDER.length : i;
  };
  const list = d.data
    .filter((r: CatalogRune) => match(q, r.name) && (color === "" || r.color === color))
    .sort((a, b) => rank(a.color) - rank(b.color) || a.name.localeCompare(b.name));
  return (
    <div className="space-y-3">
      <Chips value={color} onChange={setColor} all="ทุกสี" opts={RUNE_COLORS} />
      <Grid empty={list.length === 0}>
        {list.map((r: CatalogRune) => (
          <Card key={r.id} to={catalogPath("runes", r.name)} icon={r.icon} title={r.name} sub={RUNE_COLORS.find((c) => c.value === r.color)?.label} round />
        ))}
      </Grid>
    </div>
  );
}

// สกิลชาเลนเจอร์: ชื่อหลักเป็นภาษาอังกฤษ ชื่อไทยเป็นบรรทัดรอง
function SpellsTab({ q }: { q: string }) {
  const d = useAsync(() => getCatalogSpells(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const list = d.data.filter((s: CatalogSpell) => match(q, s.name, s.nameTh, s.slug));
  return (
    <Grid empty={list.length === 0}>
      {list.map((s: CatalogSpell) => (
        <Card key={s.id} to={catalogPath("spells", s.slug)} icon={s.icon} title={s.name || s.nameTh} sub={s.name && s.nameTh && s.nameTh !== s.name ? s.nameTh : undefined} right={s.cooldownSeconds != null ? `CD ${s.cooldownSeconds}s` : undefined} round>
          {s.status === "seasonal" && <p className="text-[11px] text-accent">ตามซีซัน</p>}
          {s.description && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{s.description}</p>}
        </Card>
      ))}
    </Grid>
  );
}

// พลังแฝง: แบ่งกลุ่มตาม Tier 1 → 3 (ในแต่ละ Tier เรียงตามสาย แล้วตาม sort_order เดิม); ไอคอนไม่มีพื้นหลัง/ไม่ครอป
function EnchantmentsTab({ q }: { q: string }) {
  const [tree, setTree] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const d = useAsync(() => getCatalogEnchantments(), []);
  const treeName = useMemo(() => new Map((d.status === "success" ? d.data.trees : []).map((t: EnchantmentTree) => [t.id, t.nameTh])), [d]);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const treeRank = new Map<string, number>(d.data.trees.map((t: EnchantmentTree, i: number): [string, number] => [t.id, i]));
  const list = d.data.list
    .filter((e: CatalogEnchantment) => match(q, e.name, e.nameTh, e.slug) && (tree === "" || e.treeId === tree) && (tier === "" || tierKey(e.tier) === tier))
    .sort((a, b) => (treeRank.get(a.treeId) ?? 99) - (treeRank.get(b.treeId) ?? 99)); // sort เสถียร: ลำดับ sort_order เดิมคงอยู่ภายในสายเดียวกัน
  const groups = groupByTier(list, (e) => e.tier);
  return (
    <div className="space-y-3">
      <Chips value={tree} onChange={setTree} all="ทุกสาย" opts={d.data.trees.map((t: EnchantmentTree) => ({ value: t.id, label: t.nameTh }))} />
      <Chips value={tier} onChange={setTier} all="ทุก Tier" opts={TIER_OPTS} />
      {groups.length === 0 ? (
        <Grid empty>{null}</Grid>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} className="space-y-3">
              <GroupHeading label={g.label} count={g.rows.length} />
              <div className={GRID}>
                {g.rows.map((e: CatalogEnchantment) => (
                  <Card key={e.id} to={catalogPath("enchantments", e.slug)} icon={e.icon} title={e.nameTh} sub={`${e.name} · ${treeName.get(e.treeId) ?? ""}`} bare>
                    {e.category === "keystone" && <p className="text-[11px] text-accent">Keystone</p>}
                    {e.description && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{e.description}</p>}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameData() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const tab: Tab = TABS.some(([t]) => t === params.get("tab")) ? (params.get("tab") as Tab) : "items";
  const nq = q.trim().toLowerCase();

  useDocumentMeta({
    title: "คลังข้อมูลเกม RoV — ไอเทม รูน สกิลชาเลนเจอร์ พลังแฝง | RoV LAB",
    description: "รวมไอเทม รูน สกิลชาเลนเจอร์ และพลังแฝงของ RoV ที่ตรวจสอบกับเกมแล้ว",
    path: "/game-data",
    breadcrumbs: [{ name: "หน้าแรก", path: "/" }, { name: "คลังข้อมูลเกม", path: "/game-data" }],
  });

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="font-display text-xl font-semibold">คลังข้อมูลเกม</h1>
        <p className="mt-1 text-sm text-text-muted">ไอเทม รูน สกิลชาเลนเจอร์ และพลังแฝง — แสดงเฉพาะรายการที่ทีมงานตรวจกับเกมแล้ว กดที่การ์ดเพื่อดูรายละเอียด</p>
      </div>

      <div role="tablist" aria-label="หมวดข้อมูล" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={chip(tab === t)} onClick={() => setParams({ tab: t }, { replace: true })}>{label}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-text-faint" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อไทย / อังกฤษ..." className="w-full bg-transparent text-base outline-none placeholder:text-text-faint sm:text-sm" />
      </div>

      {tab === "items" && <ItemsTab q={nq} />}
      {tab === "runes" && <RunesTab q={nq} />}
      {tab === "spells" && <SpellsTab q={nq} />}
      {tab === "enchantments" && <EnchantmentsTab q={nq} />}
    </div>
  );
}
