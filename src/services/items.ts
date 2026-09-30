import { MOCK_BUILDS, MOCK_ITEMS } from "@/data/items.mock";
import type { ArcanaSummary, HeroBuild, ItemSummary } from "@/types/item";
import { MOCK_PATCH } from "@/data/heroes.mock";
import { ROLE_TAGS } from "@/features/draft/heroTags";
import type { HeroSummary } from "@/types/hero";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

type DbArcanaRow = { id: string; name: string; description: string | null; icon_url: string | null };

async function fetchArcana(): Promise<ArcanaSummary[]> {
  const { data, error } = await supabase.from("arcana").select("id, name, description, icon_url").order("name", { ascending: true });
  if (error || !data) throw new Error(error?.message ?? "โหลดรายการ Arcana ไม่สำเร็จ");
  return (data as DbArcanaRow[]).map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", icon: r.icon_url ?? "" }));
}

let arcanaPromise: Promise<ArcanaSummary[]> | null = null;

// All arcana (30 rows, with icons). Offline/mock mode has none — the UI falls back to initials.
export function getArcana(): Promise<ArcanaSummary[]> {
  if (!isSupabaseConfigured) return Promise.resolve([]);
  if (!arcanaPromise) {
    arcanaPromise = fetchArcana().catch((e) => {
      arcanaPromise = null; // allow retry after a failure
      throw e;
    });
  }
  return arcanaPromise;
}

// Build entries are written like "Sage x10" (set name + count); match on the set name only.
export function findArcana(list: ArcanaSummary[], buildName: string): ArcanaSummary | undefined {
  const base = buildName.replace(/\s*[x×]\s*\d+\s*$/i, "").trim().toLowerCase();
  return list.find((a) => a.name.toLowerCase() === base);
}

// Fallback build path based on role heuristic — used until a hand-authored
// build exists for this hero. Slugs are real rows in the Supabase `items` table.
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
  return { heroSlug: hero.slug, patch: MOCK_PATCH, source: "heuristic", items, arcana: [{ name: "Sage x10", reason: "ตัวเลือกกลาง ๆ ที่เข้าได้กับเกือบทุกฮีโร่ระหว่างรอข้อมูลเฉพาะตัว" }] };
}

const COLOR_ORDER: Record<ArcanaColor, number> = { red: 0, purple: 1, green: 2 };

// บิลด์ที่แอดมินสร้างใน Supabase (item_builds + item_build_items + item_build_arcana)
// เลือกอันที่เป็น curated ก่อน แล้วเอาแพตช์ใหม่สุด; ถ้าไม่มีหรือดึงไม่สำเร็จ คืน null เพื่อใช้ fallback เดิม
async function fetchDbBuild(hero: HeroSummary): Promise<HeroBuild | null> {
  const { data, error } = await supabase
    .from("item_builds")
    .select(
      "source, patches(code, released_at), arcana(name, description, icon_url, color), item_build_items(phase, reason, sort_order, items(slug)), item_build_arcana(quantity, reason, sort_order, arcana(name, description, icon_url, color))"
    )
    .eq("hero_id", hero.id);
  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[]).filter((r) => (r.item_build_items ?? []).length > 0);
  if (rows.length === 0) return null;
  rows.sort(
    (a, b) =>
      (a.source === "curated" ? 0 : 1) - (b.source === "curated" ? 0 : 1) ||
      String(b.patches?.released_at ?? "").localeCompare(String(a.patches?.released_at ?? ""))
  );
  const r = rows[0];

  const items: HeroBuild["items"] = [...r.item_build_items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .filter((i) => i.items?.slug)
    .map((i) => ({ itemSlug: i.items.slug as string, reason: i.reason as string, phase: i.phase as HeroBuild["items"][number]["phase"] }));
  if (items.length === 0) return null;

  // รูนหลายตัว (มีสี + จำนวน) จาก item_build_arcana; ถ้าไม่มีใช้รูนชุดเดียวแบบเดิมจาก item_builds.arcana_id
  const multi: BuildArcanaEntry[] = [...(r.item_build_arcana ?? [])]
    .filter((a) => a.arcana?.name)
    .sort(
      (a, b) =>
        (COLOR_ORDER[a.arcana.color as ArcanaColor] ?? 9) - (COLOR_ORDER[b.arcana.color as ArcanaColor] ?? 9) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )
    .map((a) => ({
      name: a.arcana.name as string,
      reason: (a.reason ?? a.arcana.description ?? "") as string,
      icon: a.arcana.icon_url ?? undefined,
      color: (a.arcana.color ?? undefined) as ArcanaColor | undefined,
      quantity: a.quantity as number,
    }));
  const legacy: BuildArcanaEntry[] = r.arcana
    ? [{ name: r.arcana.name, reason: r.arcana.description ?? "", icon: r.arcana.icon_url ?? undefined, color: r.arcana.color ?? undefined }]
    : [];

  return { heroSlug: hero.slug, items, arcana: multi.length > 0 ? multi : legacy, patch: r.patches?.code ?? "N/A", source: r.source };
}

export async function getBuildForHero(hero: HeroSummary): Promise<HeroBuild> {
  if (isSupabaseConfigured) {
    const db = await fetchDbBuild(hero);
    if (db) return db;
  }
  return delay(MOCK_BUILDS[hero.slug] ?? genericBuildFor(hero));
}
