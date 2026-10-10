import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// คลังข้อมูลเกมสาธารณะ (อ่านอย่างเดียว): แสดงเฉพาะรายการที่แอดมินยืนยันกับเกมแล้ว (verified_at)
// สกิล/พลังแฝงเพิ่มเงื่อนไข status active/seasonal — test_server และ inactive ไม่เคยถูกแสดงเป็นข้อมูลเกมจริง
// ไม่มี mock: ถ้าไม่ได้ต่อ Supabase จะได้ลิสต์ว่าง

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
  name: string;
  nameTh: string;
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

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = load().catch((e) => {
        p = null; // allow retry after a failure
        throw e;
      });
    }
    return p;
  };
}

async function rows(table: string, select: string, filter: (q: any) => any, order: string): Promise<Row[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await filter(db.from(table).select(select)).order(order, { ascending: true });
  if (error || !data) throw new Error(error?.message ?? "โหลดข้อมูลไม่สำเร็จ");
  return data as Row[];
}

export const getCatalogItems = once(async (): Promise<CatalogItem[]> =>
  (await rows("items", "id, slug, name, name_th, cost, tier, role_tags, stats, passive, icon_url", (q) => q.not("verified_at", "is", null), "name")).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    nameTh: r.name_th,
    cost: r.cost,
    tier: r.tier ?? null,
    roleTags: r.role_tags ?? [],
    stats: r.stats ?? [],
    passive: r.passive ?? "",
    icon: r.icon_url ?? "",
  }))
);

export const getCatalogRunes = once(async (): Promise<CatalogRune[]> =>
  (await rows("rune", "id, name, description, color, icon_url", (q) => q.not("verified_at", "is", null), "name")).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    color: r.color ?? null,
    icon: r.icon_url ?? "",
  }))
);

export const getCatalogSpells = once(async (): Promise<CatalogSpell[]> =>
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

export const getCatalogEnchantments = once(async (): Promise<{ trees: EnchantmentTree[]; list: CatalogEnchantment[] }> => {
  const [trees, list] = await Promise.all([
    rows("enchantment_trees", "id, name, name_th", (q) => q, "sort_order"),
    rows(
      "enchantments",
      "id, slug, name, name_th, description, tier_level, category, status, icon_url, tree_id",
      (q) => q.in("status", ["active", "seasonal"]).not("verified_at", "is", null),
      "sort_order"
    ),
  ]);
  return {
    trees: trees.map((t) => ({ id: t.id, name: t.name, nameTh: t.name_th })),
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
