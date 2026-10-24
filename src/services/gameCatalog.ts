import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached, CACHE_TTL_MS } from "@/lib/ttlCache";
import { toCatalogItems, toCatalogRunes } from "@/lib/catalogRows";

// คลังข้อมูลเกมสาธารณะ (อ่านอย่างเดียว): แสดงเฉพาะรายการที่แอดมินยืนยันกับเกมแล้ว (verified_at)
// สกิล/พลังแฝงเพิ่มเงื่อนไข status active/seasonal — test_server และ inactive ไม่เคยถูกแสดงเป็นข้อมูลเกมจริง
// ไม่มี mock: ถ้าไม่ได้ต่อ Supabase จะได้ลิสต์ว่าง
//
// แคชร่วม (ttlCache คีย์ catalog:*): Hero Detail / Item Build / คลังข้อมูลเกม / รายละเอียด / Build Editor ใช้ชุดข้อมูลเดียวกัน
// เก็บข้ามการรีโหลดได้ (ข้อมูลสาธารณะล้วน) และแอดมินข้ามแคชเหมือนข้อมูลอื่น
// ไอเทม/รูนเก็บ "ทุกแถว + verified_at" ครั้งเดียว แล้วกรองตอนอ่าน: คลังข้อมูลเห็นเฉพาะที่ verified_at ไม่ว่าง
// ส่วน getItems()/getArcana() ใน items.ts (ใช้แสดงบิลด์) ยังเห็นทุกแถวเหมือนเดิม — ต้องกรองก่อนแสดงเสมอ ห้ามส่งแถวดิบออกไปที่หน้าจอ

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  cost: number;
  tier: number | null;
  roleTags: string[];
  stats: string[];
  passive: string;
  icon: string;
}
export interface CatalogRune {
  id: string;
  name: string;
  description: string;
  color: string | null;
  icon: string;
}
export interface CatalogSpell {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  description: string;
  cooldownSeconds: number | null;
  status: string;
  icon: string;
}
export interface EnchantmentTree {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  icon: string;
}
export interface CatalogEnchantment {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  description: string;
  tier: number | null;
  category: string;
  status: string;
  icon: string;
  treeId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

async function rows(table: string, select: string, filter: (q: any) => any, order: string): Promise<Row[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await filter(db.from(table).select(select)).order(order, { ascending: true });
  if (error || !data) throw new Error(error?.message ?? "โหลดข้อมูลไม่สำเร็จ");
  return data as Row[];
}

const ITEM_COLS = "id, slug, name, name_th, cost, tier, role_tags, stats, passive, icon_url, verified_at";
const RUNE_COLS = "id, name, description, color, icon_url, verified_at";
const noFilter = (q: Row) => q;

// แถวดิบทุกแถว เรียงตามชื่อ (collation ของ DB) — ไม่ cache ผลว่าง/ล้มเหลว (ลองใหม่ครั้งหน้า)
export const getCatalogItemRows = (): Promise<Row[]> => cached("catalog:items", CACHE_TTL_MS, () => rows("items", ITEM_COLS, noFilter, "name"), (v) => v.length > 0);
export const getCatalogRuneRows = (): Promise<Row[]> => cached("catalog:runes", CACHE_TTL_MS, () => rows("rune", RUNE_COLS, noFilter, "name"), (v) => v.length > 0);

export const getCatalogItems = async (): Promise<CatalogItem[]> => toCatalogItems(await getCatalogItemRows());
export const getCatalogRunes = async (): Promise<CatalogRune[]> => toCatalogRunes(await getCatalogRuneRows());

export const getCatalogSpells = (): Promise<CatalogSpell[]> =>
  cached("catalog:spells", CACHE_TTL_MS, async (): Promise<CatalogSpell[]> =>
    (
      await rows(
        "challenger_spells",
        "id, slug, name, name_th, description, cooldown_seconds, status, icon_url",
        (q) => q.in("status", ["active", "seasonal"]).not("verified_at", "is", null),
        "sort_order"
      )
    ).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      nameTh: r.name_th,
      description: r.description ?? "",
      cooldownSeconds: r.cooldown_seconds ?? null,
      status: r.status,
      icon: r.icon_url ?? "",
    }))
  );

export const getCatalogEnchantments = (): Promise<{ trees: EnchantmentTree[]; list: CatalogEnchantment[] }> =>
  cached("catalog:enchantments", CACHE_TTL_MS, async () => {
    const [trees, list] = await Promise.all([
      rows("enchantment_trees", "id, slug, name, name_th, icon_url", (q) => q, "sort_order"),
      rows(
        "enchantments",
        "id, slug, name, name_th, description, tier_level, category, status, icon_url, tree_id",
        (q) => q.in("status", ["active", "seasonal"]).not("verified_at", "is", null),
        "sort_order"
      ),
    ]);
    return {
      trees: trees.map((t) => ({ id: t.id, slug: t.slug, name: t.name, nameTh: t.name_th, icon: t.icon_url ?? "" })),
      list: list.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        nameTh: r.name_th,
        description: r.description ?? "",
        tier: r.tier_level ?? null,
        category: r.category,
        status: r.status,
        icon: r.icon_url ?? "",
        treeId: r.tree_id,
      })),
    };
  });
