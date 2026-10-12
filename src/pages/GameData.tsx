import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Library, Search } from "lucide-react";
import { getCatalogEnchantments, getCatalogItems, getCatalogRunes, getCatalogSpells, type CatalogEnchantment, type CatalogItem, type CatalogRune, type CatalogSpell, type EnchantmentTree } from "@/services/gameCatalog";
import { useAsync } from "@/hooks/useAsync";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Thumb } from "@/features/admin/ImageSelect";
import { catalogPath } from "@/features/build/buildView";
import { FILTER_KEYS, enchantmentGroups, groupByTier, itemGroups, runeList, spellList } from "@/features/gameData/catalogOrder";
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
const TIER_OPTS = ["1", "2", "3"].map((n) => ({ value: n, label: `Tier ${n}` }));
const GRID = "grid gap-2 md:grid-cols-2";
// รูน: การ์ดแนวตั้งแบบเดียวกับการ์ดฮีโร่ (ไอคอนบน ชื่อล่าง) จึงใช้กริดหลายคอลัมน์
const RUNE_GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6";

const chip = (on: boolean) =>
  `h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm transition ${on ? "border-accent bg-accent font-medium text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"}`;

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

// การ์ดทุกใบกดแล้วไปหน้ารายละเอียดของชิ้นนั้น; round = กรอบวงกลม (สกิลชาเลนเจอร์); bare = ไม่มีพื้นหลัง/ไม่ครอปไอคอน (พลังแฝง)
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

// การ์ดรูน: ไอคอนอยู่บน ชื่ออยู่ล่าง กึ่งกลาง (โครงเดียวกับ HeroCard compact)
function RuneTile({ to, icon, name }: { to: string; icon?: string; name: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 rounded-card border border-border bg-bg-surface px-1.5 py-3 text-center transition-colors hover:border-accent/40">
      <Thumb src={icon || undefined} label={name} round className="h-14 w-14 sm:h-16 sm:w-16" />
      <p className="line-clamp-2 w-full break-words text-[13px] font-normal leading-tight">{name}</p>
    </Link>
  );
}

function Grid({ empty, className = GRID, children }: { empty: boolean; className?: string; children: React.ReactNode }) {
  if (empty) return <EmptyState icon={Library} title="ไม่พบรายการ" description="ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น" />;
  return <div className={className}>{children}</div>;
}

function Gold({ cost }: { cost: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <img src="/gold.svg" alt="gold" className="h-3.5 w-3.5 object-contain" loading="lazy" />
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

// ตัวกรอง chip จำไว้ผ่าน usePersistedState (รีเฟรช/สลับแรงก์แล้วไม่หาย) — ช่องค้นหาไม่จำ เหมือนหน้าฮีโร่
function ItemsTab({ q }: { q: string }) {
  const [type, setType] = usePersistedState<string>(FILTER_KEYS.itemType, "");
  const [tier, setTier] = usePersistedState<string>(FILTER_KEYS.itemTier, "");
  const d = useAsync(() => getCatalogItems(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const groups = itemGroups(d.data, { q, type, tier });
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

// รูน: เรียงสี แดง → ม่วง → เขียว; การ์ดแนวตั้ง ไอคอนบน-ชื่อล่าง (คำอธิบายดูในหน้ารายละเอียด)
function RunesTab({ q }: { q: string }) {
  const [color, setColor] = usePersistedState<string>(FILTER_KEYS.runeColor, "");
  const d = useAsync(() => getCatalogRunes(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const list = runeList(d.data, { q, color });
  return (
    <div className="space-y-3">
      <Chips value={color} onChange={setColor} all="ทุกสี" opts={RUNE_COLORS} />
      <Grid empty={list.length === 0} className={RUNE_GRID}>
        {list.map((r: CatalogRune) => (
          <RuneTile key={r.id} to={catalogPath("runes", r.name)} icon={r.icon} name={r.name} />
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
  const list = spellList(d.data, { q });
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

// พลังแฝง: แบ่งกลุ่มตามสาย แล้วย่อยตาม Tier 1 → 3 ภายในสาย; ชื่อพลังแฝงและชื่อสายแสดงเป็นภาษาอังกฤษ (ชื่อไทยเป็นบรรทัดรอง)
function EnchantmentsTab({ q }: { q: string }) {
  const [tree, setTree] = usePersistedState<string>(FILTER_KEYS.enchTree, "");
  const [tier, setTier] = usePersistedState<string>(FILTER_KEYS.enchTier, "");
  const d = useAsync(() => getCatalogEnchantments(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const groups = enchantmentGroups(d.data, { q, tree, tier });
  return (
    <div className="space-y-3">
      <Chips value={tree} onChange={setTree} all="ทุกสาย" opts={d.data.trees.map((t: EnchantmentTree) => ({ value: t.id, label: t.name }))} />
      <Chips value={tier} onChange={setTier} all="ทุก Tier" opts={TIER_OPTS} />
      {groups.length === 0 ? (
        <Grid empty>{null}</Grid>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.tree.id} className="space-y-3">
              <GroupHeading label={g.tree.name} count={g.rows.length} />
              {groupByTier(g.rows, (e: CatalogEnchantment) => e.tier).map((t) => (
                <div key={t.key}>
                  <TierHeading label={t.label} />
                  <div className={GRID}>
                    {t.rows.map((e: CatalogEnchantment) => (
                      <Card key={e.id} to={catalogPath("enchantments", e.slug)} icon={e.icon} title={e.name || e.nameTh} sub={e.name && e.nameTh && e.nameTh !== e.name ? e.nameTh : undefined} bare>
                        {e.category === "keystone" && <p className="text-[11px] text-accent">Keystone</p>}
                        {e.description && <p className="mt-1 line-clamp-2 text-sm text-text-muted">{e.description}</p>}
                      </Card>
                    ))}
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
