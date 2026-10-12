import { ITEM_TYPES } from "@/lib/catalogAdmin";
import type { CatalogEnchantment, CatalogItem, CatalogRune, CatalogSpell, EnchantmentTree } from "@/services/gameCatalog";

// ลำดับ/การกรอง/การจัดกลุ่มของคลังข้อมูลเกม — ใช้ร่วมกันระหว่างหน้ารายการ (pages/GameData) กับปุ่ม ก่อนหน้า/ถัดไป
// ในหน้ารายละเอียด (useCatalogNeighbors) เพื่อให้ลำดับตรงกับที่ผู้ใช้เห็นเสมอ

// คีย์ตัวกรองที่จำไว้ใน sessionStorage (ผ่าน usePersistedState) — รีเฟรช/สลับแรงก์แล้วตัวกรองไม่หาย เหมือนหน้าฮีโร่
export const FILTER_KEYS = {
  itemType: "rovlab:filter:gamedata:items:type",
  itemTier: "rovlab:filter:gamedata:items:tier",
  runeColor: "rovlab:filter:gamedata:runes:color",
  enchTree: "rovlab:filter:gamedata:enchantments:tree",
  enchTier: "rovlab:filter:gamedata:enchantments:tier",
} as const;

// ลำดับสีรูนที่แสดง: แดง → ม่วง → เขียว (สีอื่น/ไม่ระบุไปท้ายสุด)
const RUNE_ORDER = ["red", "purple", "green"];

export const match = (q: string, ...vals: (string | undefined)[]) => q === "" || vals.some((v) => (v ?? "").toLowerCase().includes(q));

export const tierKey = (t: number | null) => (t == null ? "none" : String(t));

// แบ่งกลุ่มตาม Tier เรียง 1 → 3 (ไม่ระบุ Tier ไว้ท้ายสุด)
export function groupByTier<T>(list: T[], tierOf: (x: T) => number | null): { key: string; label: string; rows: T[] }[] {
  const keys = [...new Set(list.map((x) => tierKey(tierOf(x))))].sort((a, b) => (a === "none" ? 1 : b === "none" ? -1 : Number(a) - Number(b)));
  return keys.map((k) => ({ key: k, label: k === "none" ? "ไม่ระบุ Tier" : `Tier ${k}`, rows: list.filter((x) => tierKey(tierOf(x)) === k) }));
}

// ไอเทม: กรอง → เรียงตามราคา/ชื่อ → แบ่งกลุ่มตามประเภท (ITEM_TYPES) แต่ละไอเทมอยู่กลุ่มเดียว (ไม่ตรงเลย → "อื่น ๆ")
export type ItemGroup = { value: string; label: string; rows: CatalogItem[] };
export function itemGroups(all: CatalogItem[], f: { q: string; type: string; tier: string }): ItemGroup[] {
  const list = all
    .filter((i) => match(f.q, i.name, i.nameTh, i.slug) && (f.type === "" || i.roleTags.includes(f.type)) && (f.tier === "" || tierKey(i.tier) === f.tier))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const groupOf = (i: CatalogItem) => ITEM_TYPES.find((t) => i.roleTags.includes(t.value))?.value ?? "other";
  return [...ITEM_TYPES, { value: "other", label: "อื่น ๆ" }]
    .map((g) => ({ value: g.value as string, label: g.label as string, rows: list.filter((i) => groupOf(i) === g.value) }))
    .filter((g) => g.rows.length > 0);
}
// ลำดับตามที่แสดงบนจอ: กลุ่ม → Tier → ไอเทม
export const flattenItemGroups = (groups: ItemGroup[]): CatalogItem[] => groups.flatMap((g) => groupByTier(g.rows, (i) => i.tier).flatMap((t) => t.rows));

// รูน: เรียงสี แดง → ม่วง → เขียว แล้วตามชื่อ
export function runeList(all: CatalogRune[], f: { q: string; color: string }): CatalogRune[] {
  const rank = (c: string | null) => {
    const i = RUNE_ORDER.indexOf(c ?? "");
    return i < 0 ? RUNE_ORDER.length : i;
  };
  return all
    .filter((r) => match(f.q, r.name) && (f.color === "" || r.color === f.color))
    .sort((a, b) => rank(a.color) - rank(b.color) || a.name.localeCompare(b.name));
}

// สกิลชาเลนเจอร์: คงลำดับ sort_order จากฐานข้อมูล
export function spellList(all: CatalogSpell[], f: { q: string }): CatalogSpell[] {
  return all.filter((s) => match(f.q, s.name, s.nameTh, s.slug));
}

// พลังแฝง: แบ่งกลุ่มตามสาย (ลำดับสายจากฐานข้อมูล) แล้วแบ่งย่อยตาม Tier ภายในสาย; สายที่ไม่รู้จักไปกลุ่ม "Other"
export type EnchantmentGroup = { tree: EnchantmentTree; rows: CatalogEnchantment[] };
export function enchantmentGroups(data: { trees: EnchantmentTree[]; list: CatalogEnchantment[] }, f: { q: string; tree: string; tier: string }): EnchantmentGroup[] {
  const list = data.list.filter(
    (e) => match(f.q, e.name, e.nameTh, e.slug) && (f.tree === "" || e.treeId === f.tree) && (f.tier === "" || tierKey(e.tier) === f.tier)
  );
  const groups: EnchantmentGroup[] = data.trees.map((t) => ({ tree: t, rows: list.filter((e) => e.treeId === t.id) })).filter((g) => g.rows.length > 0);
  const orphans = list.filter((e) => !data.trees.some((t) => t.id === e.treeId));
  if (orphans.length > 0) groups.push({ tree: { id: "other", name: "Other", nameTh: "อื่น ๆ" }, rows: orphans });
  return groups;
}
export const flattenEnchantmentGroups = (groups: EnchantmentGroup[]): CatalogEnchantment[] =>
  groups.flatMap((g) => groupByTier(g.rows, (e) => e.tier).flatMap((t) => t.rows));
