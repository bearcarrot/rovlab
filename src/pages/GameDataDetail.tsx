import { useParams } from "react-router-dom";
import { BadgeCheck, Library } from "lucide-react";
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
import { CatalogPager } from "@/features/gameData/CatalogPager";
import { useCatalogNeighbors } from "@/features/gameData/useCatalogNeighbors";
import { shortStats } from "@/features/gameData/catalogOrder";
import { ITEM_TYPES, RUNE_COLORS } from "@/lib/catalogAdmin";

// หน้าคลังข้อมูลของแต่ละชิ้น (ไอเทม/รูน/สกิลชาเลนเจอร์/พลังแฝง) — แสดงเฉพาะรายการที่ยืนยันกับเกมแล้ว
// ปุ่มย้อนกลับ + breadcrumb มาจาก WithNav ที่ระดับ route (App.tsx) จึงไม่ใส่ลิงก์กลับซ้ำในหน้านี้
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
      return v ? { k, v, tree: d.trees.find((t) => t.id === v.treeId)?.name ?? "" } : null;
    }
    return null;
  }, [kind, key]);

  // ปุ่ม < > ไปรายการก่อนหน้า/ถัดไป ตามตัวกรอง chip ที่เลือกไว้ในหน้ารายการ (ต้องเรียกก่อน early return)
  // คำนวณจาก key ใน URL จึงทำงานได้แม้เปิดลิงก์ตรง/รีเฟรช และแสดงทันทีแม้รายการใหม่ยังโหลดอยู่
  const neighbors = useCatalogNeighbors(k, key);
  const pager = neighbors ? (
    <CatalogPager neighbors={neighbors} caption={`${neighbors.index + 1}/${neighbors.total}${neighbors.filtered ? " · ตามตัวกรอง" : ""}`} />
  ) : null;

  const f = q.status === "success" ? q.data : null;
  // ชื่อหลักเป็นภาษาอังกฤษ ชื่อไทย (ถ้ามีและต่างกัน) เป็นบรรทัดรอง
  const title = f ? f.v.name || ("nameTh" in f.v ? f.v.nameTh : "") : "";
  const sub = f && "nameTh" in f.v && f.v.nameTh && f.v.nameTh !== f.v.name ? f.v.nameTh : "";
  useDocumentMeta({
    title: f ? `${title} — ${KIND_LABEL[f.k]} RoV | RoV LAB` : "คลังข้อมูลเกม RoV | RoV LAB",
    description: f ? `รายละเอียด${KIND_LABEL[f.k]} ${title} ใน RoV` : "คลังข้อมูลเกม RoV",
    path: `/game-data/${kind}/${encodeURIComponent(key)}`,
    breadcrumbs: [{ name: "หน้าแรก", path: "/" }, { name: "คลังข้อมูลเกม", path: "/game-data" }],
  });

  if (q.status === "loading") {
    return (
      <div className="space-y-4">
        {pager}
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (q.status === "error") return <ErrorState message={q.message} onRetry={q.refetch} />;
  if (!f) {
    return <EmptyState icon={Library} title="ไม่พบรายการนี้" description="รายการอาจยังไม่ได้รับการยืนยันกับเกมหรือถูกลบแล้ว" />;
  }

  const round = f.k === "runes" || f.k === "spells";
  const icon = f.v.icon || undefined;
  const stats = f.k === "items" ? shortStats(f.v.stats) : [];

  return (
    <div className="space-y-4 pb-4">
      {pager}
      <div className="flex items-center gap-4">
        <Thumb src={icon} label={title} round={round} className="h-20 w-20" />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold leading-snug">{title}</h1>
          {sub && <p className="text-sm text-text-faint">{sub}</p>}
          <p className="flex items-center gap-1 text-xs text-accent">
            <span>{KIND_LABEL[f.k]}</span>
            <span aria-hidden>·</span>
            <BadgeCheck aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span>ยืนยันกับเกมแล้ว</span>
          </p>
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
            {f.v.tier && <Row label="Tier">Tier {f.v.tier}</Row>}
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

      {stats.length > 0 && (
        <ul className="space-y-1 rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">
          {stats.map((s) => <li key={s}>{s}</li>)}
        </ul>
      )}
      {f.k === "items" && f.v.passive && <p className="whitespace-pre-line rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">{f.v.passive}</p>}
      {f.k !== "items" && f.v.description && <p className="whitespace-pre-line rounded-card border border-border bg-bg-surface p-4 text-sm text-text-muted">{f.v.description}</p>}
    </div>
  );
}
