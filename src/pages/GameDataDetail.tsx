import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Library } from "lucide-react";
import {
  getCatalogEnchantments, getCatalogItems, getCatalogRunes, getCatalogSpells,
  type CatalogEnchantment, type CatalogItem, type CatalogRune, type CatalogSpell,
} from "@/services/gameCatalog";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Skeleton } from "@/components/layout/Skeleton";
import { ErrorState } from "@/components/layout/ErrorState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Thumb } from "@/features/admin/ImageSelect";
import { ITEM_TYPES, RUNE_COLORS } from "@/lib/catalogAdmin";
import type { CatalogNavState, NavEntry } from "@/lib/catalogNav";

// หน้าคลังข้อมูลของแต่ละชิ้น (ไอเทม/รูน/สกิลชาเลนเจอร์/พลังแฝง) — แสดงเฉพาะรายการที่ยืนยันกับเกมแล้ว
type Found =
  | { k: "items"; v: CatalogItem }
  | { k: "runes"; v: CatalogRune }
  | { k: "spells"; v: CatalogSpell }
  | { k: "enchantments"; v: CatalogEnchantment; tree: string }
  | null;

const KINDS = ["items", "runes", "spells", "enchantments"] as const;
const KIND_LABEL: Record<(typeof KINDS)[number], string> = { items: "ไอเทม", runes: "รูน", spells: "สกิลชาเลนเจอร์", enchantments: "พลังแฝง" };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-text-faint">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

// ก่อนหน้า/ถัดไป ตามลำดับที่ผู้ใช้เห็นในหน้ารายการ (รวมตัวกรอง/ค้นหา); ใช้ replace เพื่อให้ปุ่มย้อนกลับกลับไปหน้ารายการในครั้งเดียว
function Pager({ nav, idx }: { nav: NavEntry[]; idx: number }) {
  const prev = idx > 0 ? nav[idx - 1] : null;
  const next = idx < nav.length - 1 ? nav[idx + 1] : null;
  const state: CatalogNavState = { nav };
  const base = "flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg border px-3 text-sm transition";
  const on = "border-border bg-bg-surface text-text-muted hover:border-accent/40 hover:text-text";
  const off = "border-border/50 text-text-faint/50";
  return (
    <nav aria-label="ก่อนหน้า / ถัดไป" className="flex items-center gap-2">
      {prev ? (
        <Link to={prev.to} state={state} replace aria-label={`ก่อนหน้า: ${prev.name}`} className={`${base} ${on}`}>
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{prev.name}</span>
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} ${off}`}>
          <ChevronLeft className="h-4 w-4 shrink-0" />ก่อนหน้า
        </span>
      )}
      {next ? (
        <Link to={next.to} state={state} replace aria-label={`ถัดไป: ${next.name}`} className={`${base} justify-end ${on}`}>
          <span className="truncate">{next.name}</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} justify-end ${off}`}>
          ถัดไป<ChevronRight className="h-4 w-4 shrink-0" />
        </span>
      )}
    </nav>
  );
}

export function GameDataDetail() {
  const { kind = "", key = "" } = useParams();
  const { pathname, state } = useLocation();
  const k = KINDS.find((x) => x === kind);
  const q = useAsync(async (): Promise<Found> => {
    const want = key.toLowerCase();
    if (k === "items") {
      const v = (await getCatalogItems()).find((x) => x.slug === key);
      return v ? { k, v } : null;
    }
    if (k === "runes") {
      const v = (await getCatalogRunes()).find((x) => x.name.toLowerCase() === want);
      return v ? { k, v } : null;
    }
    if (k === "spells") {
      const v = (await getCatalogSpells()).find((x) => x.slug === key);
      return v ? { k, v } : null;
    }
    if (k === "enchantments") {
      const d = await getCatalogEnchantments();
      const v = d.list.find((x) => x.slug === key);
      return v ? { k, v, tree: d.trees.find((t) => t.id === v.treeId)?.nameTh ?? "" } : null;
    }
    return null;
  }, [kind, key]);

  // เลื่อนขึ้นบนสุดเมื่อกด ก่อนหน้า/ถัดไป (เปลี่ยนรายการแต่ยังอยู่คอมโพเนนต์เดิม)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [kind, key]);

  // มี nav เฉพาะเมื่อเข้ามาจากหน้ารายการ (เปิดลิงก์ตรง/รีเฟรช = ไม่มีปุ่ม ก่อนหน้า/ถัดไป)
  const rawNav = (state as Partial<CatalogNavState> | null)?.nav;
  const nav = Array.isArray(rawNav) ? rawNav : null;
  const idx = nav ? nav.findIndex((n) => decode(n.to) === decode(pathname)) : -1;
  const pager = nav && idx >= 0 && nav.length > 1 ? <Pager nav={nav} idx={idx} /> : null;

  const f = q.status === "success" ? q.data : null;
  const title = f ? (f.k === "spells" || f.k === "enchantments" ? f.v.nameTh : f.v.name) : "";
  useDocumentMeta({
    title: f ? `${title} — ${KIND_LABEL[f.k]} RoV | RoV LAB` : "คลังข้อมูลเกม RoV | RoV LAB",
    description: f ? `รายละเอียด${KIND_LABEL[f.k]} ${title} ใน RoV` : "คลังข้อมูลเกม RoV",
    path: `/game-data/${kind}/${encodeURIComponent(key)}`,
    breadcrumbs: [{ name: "หน้าแรก", path: "/" }, { name: "คลังข้อมูลเกม", path: "/game-data" }],
  });

  const back = (
    <Link to={`/game-data?tab=${k ?? "items"}`} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent">
      <ChevronLeft className="h-4 w-4" />กลับไปคลังข้อมูล{k ? ` · ${KIND_LABEL[k]}` : ""}
    </Link>
  );

  if (q.status === "loading") return <Skeleton className="h-48" />;
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  if (!f) {
    return (
      <div className="space-y-3">
        {back}
        <EmptyState icon={Library} title="ไม่พบรายการนี้" description="รายการอาจยังไม่ได้รับการยืนยันกับเกมหรือถูกลบแล้ว" />
      </div>
    );
  }

  const round = f.k === "runes" || f.k === "spells";
  const icon = f.v.icon || undefined;
  const name = f.v.name;
  const sub = f.k === "spells" || f.k === "enchantments" ? f.v.name : f.k === "items" && f.v.nameTh !== f.v.name ? f.v.nameTh : "";

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2">
        {back}
        {nav && idx >= 0 && nav.length > 1 && <span className="shrink-0 text-xs text-text-faint">{idx + 1} / {nav.length}</span>}
      </div>
      {pager}
      <div className="flex items-center gap-4">
        <Thumb src={icon} label={name} round={round} className="h-20 w-20" />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-snug">{f.k === "spells" || f.k === "enchantments" ? f.v.nameTh : name}</h1>
          {sub && <p className="text-sm text-text-faint">{sub}</p>}
          <p className="text-xs text-accent">{KIND_LABEL[f.k]} · ยืนยันกับเกมแล้ว</p>
        </div>
      </div>

      <div className="rounded-card border border-border bg-bg-surface px-4 py-1">
        {f.k === "items" && (
          <>
            <Row label="ราคา">
              <span className="inline-flex items-center justify-end gap-1.5">
                <img src="/gold.svg" alt="gold" className="h-4 w-4 object-contain" />
                {f.v.cost.toLocaleString()}
              </span>
            </Row>
            {f.v.tier && <Row label="Tier">T{f.v.tier}</Row>}
            {f.v.roleTags.length > 0 && <Row label="ประเภท">{f.v.roleTags.map((t) => ITEM_TYPES.find((o) => o.value === t)?.label ?? t).join(" · ")}</Row>}
          </>
        )}
        {f.k === "runes" && <Row label="สี">{RUNE_COLORS.find((c) => c.value === f.v.color)?.label ?? "-"}</Row>}
        {f.k === "spells" && (
          <>
            {f.v.cooldownSeconds != null && <Row label="คูลดาวน์">{f.v.cooldownSeconds} วินาที</Row>}
            {f.v.status === "seasonal" && <Row label="สถานะ">ตามซีซัน</Row>}
          </>
        )}
        {f.k === "enchantments" && (
          <>
            {f.tree && <Row label="สาย">{f.tree}</Row>}
            {f.v.tier && <Row label="Tier">Tier {f.v.tier}</Row>}
            {f.v.category === "keystone" && <Row label="ประเภท">Keystone</Row>}
            {f.v.status === "seasonal" && <Row label="สถานะ">ตามซีซัน</Row>}
          </>
        )}
      </div>

      {f.k === "items" && f.v.stats.filter((s) => s.length <= 40).length > 0 && (
        <ul className="space-y-1 rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">
          {f.v.stats.filter((s) => s.length <= 40).map((s) => <li key={s}>{s}</li>)}
        </ul>
      )}
      {f.k === "items" && f.v.passive && <p className="whitespace-pre-line rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">{f.v.passive}</p>}
      {f.k !== "items" && f.v.description && <p className="whitespace-pre-line rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">{f.v.description}</p>}
      {pager}
    </div>
  );
}
