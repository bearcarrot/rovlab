import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Library } from "lucide-react";
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

// หน้าคลังข้อมูลของแต่ละชิ้น (ไอเทม/รูน/สกิลชาเลนเจอร์/พลังแฝง) — แสดงเฉพาะรายการที่ยืนยันกับเกมแล้ว
type Found =
  | { k: "items"; v: CatalogItem }
  | { k: "runes"; v: CatalogRune }
  | { k: "spells"; v: CatalogSpell }
  | { k: "enchantments"; v: CatalogEnchantment; tree: string }
  | null;

const KINDS = ["items", "runes", "spells", "enchantments"] as const;
const KIND_LABEL: Record<(typeof KINDS)[number], string> = { items: "ไอเทม", runes: "รูน", spells: "สกิลชาเลนเจอร์", enchantments: "พลังแฝง" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-text-faint">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function GameDataDetail() {
  const { kind = "", key = "" } = useParams();
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
      {back}
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
            <Row label="ราคา">{f.v.cost.toLocaleString()} ทอง</Row>
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
          {f.v.stats.filter((s) => s.length <= 40).map((s) => <li key={s}>• {s}</li>)}
        </ul>
      )}
      {f.k === "items" && f.v.passive && <p className="whitespace-pre-line rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">{f.v.passive}</p>}
      {f.k !== "items" && f.v.description && <p className="whitespace-pre-line rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">{f.v.description}</p>}
    </div>
  );
}
