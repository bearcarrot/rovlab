import { MOCK_BUILDS, MOCK_ITEMS } from "@/data/items.mock";
import type { BuildArcanaEntry, BuildItemEntry, HeroBuild, ItemSummary } from "@/types/item";
import { MOCK_PATCH } from "@/data/heroes.mock";
import { ROLE_TAGS } from "@/features/draft/heroTags";
import type { HeroSummary } from "@/types/hero";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getLatestPatch } from "@/services/meta";

const SIMULATED_LATENCY = 250;
function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), SIMULATED_LATENCY));
}

type DbItemRow = {
  id: string;
  slug: string;
  name: string;
  name_th: string;
  cost: number;
  stats: string[] | null;
  passive: string | null;
  icon_url: string | null;
};

function toItem(row: DbItemRow): ItemSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameTh: row.name_th,
    cost: row.cost,
    stats: row.stats ?? [],
    passive: row.passive ?? "",
    icon: row.icon_url ?? "",
  };
}

async function fetchItems(): Promise<ItemSummary[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, slug, name, name_th, cost, stats, passive, icon_url")
    .order("cost", { ascending: false });
  if (error || !data) throw new Error(error?.message ?? "โหลดรายการไอเทมไม่สำเร็จ");
  return (data as DbItemRow[]).map(toItem);
}

// Items are the same for every build row on the page, so fetch once and share.
let itemsPromise: Promise<ItemSummary[]> | null = null;

export function getItems(): Promise<ItemSummary[]> {
  if (!isSupabaseConfigured) return delay(MOCK_ITEMS);
  if (!itemsPromise) {
    itemsPromise = fetchItems().catch((e) => {
      itemsPromise = null; // allow retry after a failure
      throw e;
    });
  }
  return itemsPromise;
}

// Fallback build path based on role heuristic — used until a hand-authored
// build exists for this hero. Slugs are real rows in the Supabase `items` table.
// Arcana are intentionally left empty here: we only show rune pages that exist in the DB.
const GENERIC_PICKS = {
  magic: {
    boots: { slug: "giay-thuat-si", reason: "ลดคูลดาวน์และเพิ่มความเร็วเคลื่อนที่ ช่วยให้ใช้สกิลได้ถี่ขึ้น" },
    core: { slug: "sach-thanh", reason: "เพิ่มพลังโจมตีเวทสูงและลดคูลดาวน์ เป็นแกนหลักของดาเมจ" },
  },
  physical: {
    boots: { slug: "giay-du-muc", reason: "เพิ่มความเร็วโจมตีและความเร็วเคลื่อนที่ เหมาะกับสายโจมตีพื้นฐาน" },
    core: { slug: "nanh-fenrir", reason: "เพิ่มพลังโจมตีสูงเป็นแกนหลักของดาเมจ" },
  },
} as const;

function genericBuildFor(hero: HeroSummary): HeroBuild {
  const tag = ROLE_TAGS[hero.role];
  const pick = tag.damage === "magic" ? GENERIC_PICKS.magic : GENERIC_PICKS.physical;
  const items: HeroBuild["items"] = [
    { itemSlug: pick.boots.slug, reason: pick.boots.reason, phase: "early" },
    { itemSlug: pick.core.slug, reason: pick.core.reason, phase: "core" },
  ];
  if (tag.frontline >= 2) {
    items.push({ itemSlug: "khien-that-truyen", reason: "เพิ่มเกราะและพลังชีวิตให้ยืนแนวหน้าได้นานขึ้น", phase: "core" });
  } else {
    items.push({ itemSlug: "giap-gaia", reason: "ซื้อเมื่อฝั่งศัตรูมีดาเมจเวทสูง เพิ่มต้านทานเวทและพลังชีวิตเพื่อลดความเสี่ยงโดนล้ม", phase: "situational" });
  }
  return { heroSlug: hero.slug, patch: MOCK_PATCH, source: "heuristic", items, arcana: [] };
}

type DbBuildRow = {
  source: string | null;
  arcana: { name: string; description: string | null; icon_url: string | null } | null;
  item_build_items: {
    phase: string;
    reason: string | null;
    sort_order: number | null;
    item: { slug: string } | null;
  }[];
};

const PHASES = ["early", "core", "situational"] as const;

// item_builds holds one row per arcana, so a hero's rune page = all of its rows.
async function fetchDbBuild(hero: HeroSummary) {
  const { data, error } = await supabase
    .from("item_builds")
    .select("source, arcana:arcana_id(name, description, icon_url), item_build_items(phase, reason, sort_order, item:item_id(slug))")
    .eq("hero_id", hero.id);
  if (error || !data || data.length === 0) return null;
  const rows = data as unknown as DbBuildRow[];

  const arcana: BuildArcanaEntry[] = [];
  for (const r of rows) {
    if (r.arcana && !arcana.some((a) => a.name === r.arcana!.name)) {
      arcana.push({ name: r.arcana.name, reason: r.arcana.description ?? "", icon: r.arcana.icon_url ?? undefined });
    }
  }

  const items: BuildItemEntry[] = [];
  const dbItems = rows.flatMap((r) => r.item_build_items ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const it of dbItems) {
    if (!it.item?.slug || items.some((x) => x.itemSlug === it.item!.slug)) continue;
    const phase = (PHASES as readonly string[]).includes(it.phase) ? (it.phase as BuildItemEntry["phase"]) : "core";
    items.push({ itemSlug: it.item.slug, reason: it.reason ?? "", phase });
  }

  return { arcana, items, source: rows.some((r) => r.source === "curated") ? ("curated" as const) : ("heuristic" as const) };
}

export async function getBuildForHero(hero: HeroSummary): Promise<HeroBuild> {
  const curatedMock = MOCK_BUILDS[hero.slug];
  const base = curatedMock ?? genericBuildFor(hero);
  if (!isSupabaseConfigured) return delay(base);

  const [db, patch] = await Promise.all([fetchDbBuild(hero).catch(() => null), getLatestPatch().catch(() => null)]);
  const hasDbItems = !!db && db.items.length > 0;
  return {
    ...base,
    patch: patch?.code ?? base.patch,
    items: hasDbItems ? db!.items : base.items,
    source: hasDbItems ? db!.source : base.source,
    // Only real rune data: DB rows first, then the hand-authored mock (if any), else none.
    arcana: db ? db.arcana : curatedMock?.arcana ?? [],
  };
}
