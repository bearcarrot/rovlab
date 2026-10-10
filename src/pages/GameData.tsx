import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Library, Search } from "lucide-react";
import {
  getCatalogEnchantments, getCatalogItems, getCatalogRunes, getCatalogSpells,
  type CatalogEnchantment, type CatalogItem, type CatalogRune, type CatalogSpell, type EnchantmentTree,
} from "@/services/gameCatalog";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { HeroIcon } from "@/components/HeroIcon";
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
// บางแถวเก็บคำอธิบายยาวไว้ใน stats แสดงเฉพาะบรรทัดสั้น (เหมือหน้าบิลด์)
const MAX_STAT_LENGTH = 40;

const chip = (on: boolean) =>
  `h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm transition ${on ? "border-accent bg-accent font-medium text-accent-fg" : "border-border bg-bg-surface text-text-muted hover:text-text"}`;

const match = (q: string, ...vals: (string | undefined)[]) => q === "" || vals.some((v) => (v ?? "").toLowerCase().includes(q));

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

function Card({ icon, title, sub, right, children }: { icon?: string; title: string; sub?: string; right?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-card border border-border bg-bg-surface p-3">
      <HeroIcon icon={icon} name={title} className="h-11 w-11 shrink-0 bg-bg-raised" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-sm font-medium leading-snug">{title}</p>
          {right && <span className="shrink-0 text-xs text-text-faint">{right}</span>}
        </div>
        {sub && <p className="text-xs text-text-faint">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

function ItemsTab({ q }: { q: string }) {
  const [type, setType] = useState<string>("");
  const d = useAsync(() => getCatalogItems(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const list = d.data.filter((i: CatalogItem) => match(q, i.name, i.nameTh, i.slug) && (type === "" || i.roleTags.includes(type)));
  return (
    <div className="space-y-3">
      <Chips value={type} onChange={setType} all="ทุกประเภท" opts={ITEM_TYPES} />
      <Grid empty={list.length === 0}>
        {list.map((i: CatalogItem) => (
          <Card key={i.id} icon={i.icon} title={i.name} sub={i.tier ? `Tier ${i.tier}` : undefined} right={`${i.cost.toLocaleString()}g`}>
            {i.stats.filter((s) => s.length <= MAX_STAT_LENGTH).length > 0 && (
              <p className="mt-1 text-xs text-text-muted">{i.stats.filter((s) => s.length <= MAX_STAT_LENGTH).join(" · ")}</p>
            )}
            {i.passive && <p className="mt-1 whitespace-pre-line text-sm text-text-muted">{i.passive}</p>}
          </Card>
        ))}
      </Grid>
    </div>
  );
}

function RunesTab({ q }: { q: string }) {
  const [color, setColor] = useState<string>("");
  const d = useAsync(() => getCatalogRunes(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const list = d.data.filter((r: CatalogRune) => match(q, r.name) && (color === "" || r.color === color));
  return (
    <div className="space-y-3">
      <Chips value={color} onChange={setColor} all="ทุกสี" opts={RUNE_COLORS} />
      <Grid empty={list.length === 0}>
        {list.map((r: CatalogRune) => (
          <Card key={r.id} icon={r.icon} title={r.name} sub={RUNE_COLORS.find((c) => c.value === r.color)?.label}>
            {r.description && <p className="mt-1 text-sm text-text-muted">{r.description}</p>}
          </Card>
        ))}
      </Grid>
    </div>
  );
}

function SpellsTab({ q }: { q: string }) {
  const d = useAsync(() => getCatalogSpells(), []);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const list = d.data.filter((s: CatalogSpell) => match(q, s.name, s.nameTh, s.slug));
  return (
    <Grid empty={list.length === 0}>
      {list.map((s: CatalogSpell) => (
        <Card key={s.id} icon={s.icon} title={`${s.nameTh}`} sub={s.name} right={s.cooldownSeconds != null ? `CD ${s.cooldownSeconds}s` : undefined}>
          {s.status === "seasonal" && <p className="text-[11px] text-accent">ตามซีซัน</p>}
          {s.description && <p className="mt-1 text-sm text-text-muted">{s.description}</p>}
        </Card>
      ))}
    </Grid>
  );
}

function EnchantmentsTab({ q }: { q: string }) {
  const [tree, setTree] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const d = useAsync(() => getCatalogEnchantments(), []);
  const treeName = useMemo(() => new Map((d.status === "success" ? d.data.trees : []).map((t: EnchantmentTree) => [t.id, t.nameTh])), [d]);
  if (d.status === "loading") return <Skeleton className="h-40" />;
  if (d.status === "error") return <ErrorState message={d.message} onRetry={d.refetch} />;
  const list = d.data.list.filter(
    (e: CatalogEnchantment) => match(q, e.name, e.nameTh, e.slug) && (tree === "" || e.treeId === tree) && (tier === "" || String(e.tier) === tier)
  );
  return (
    <div className="space-y-3">
      <Chips value={tree} onChange={setTree} all="ทุกสาย" opts={d.data.trees.map((t: EnchantmentTree) => ({ value: t.id, label: t.nameTh }))} />
      <Chips value={tier} onChange={setTier} all="ทุก Tier" opts={["1", "2", "3"].map((n) => ({ value: n, label: `Tier ${n}` }))} />
      <Grid empty={list.length === 0}>
        {list.map((e: CatalogEnchantment) => (
          <Card key={e.id} icon={e.icon} title={e.nameTh} sub={`${e.name} · ${treeName.get(e.treeId) ?? ""}`} right={e.tier ? `Tier ${e.tier}` : undefined}>
            {e.category === "keystone" && <p className="text-[11px] text-accent">Keystone</p>}
            {e.description && <p className="mt-1 whitespace-pre-line text-sm text-text-muted">{e.description}</p>}
          </Card>
        ))}
      </Grid>
    </div>
  );
}

function Grid({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) return <EmptyState icon={Library} title="ไม่พบรายการ" description="ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น" />;
  return <div className="grid gap-2 md:grid-cols-2">{children}</div>;
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
        <p className="mt-1 text-sm text-text-muted">ไอเทม รูน สกิลชาเลนเจอร์ และพลังแฝง — แสดงเฉพาะรายการที่ทีมงานตรวจกับเกมแล้ว</p>
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
