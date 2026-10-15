import { MOCK_BUILDS, MOCK_ITEMS } from "@/data/items.mock";
import type { ArcanaColor, ArcanaSummary, BuildArcanaEntry, BuildEnchantment, BuildSpell, HeroBuild, ItemSummary } from "@/types/item";
import { MOCK_PATCH } from "@/data/heroes.mock";
import { ROLE_TAGS } from "@/features/draft/heroTags";
import type { HeroSummary } from "@/types/hero";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached, CACHE_TTL_MS } from "@/lib/ttlCache";

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

type DbRuneRow = { id: string; name: string; description: string | null; icon_url: string | null };

async function fetchArcana(): Promise<ArcanaSummary[]> {
  const { data, error } = await supabase.from("rune").select("id, name, description, icon_url").order("name", { ascending: true });
  if (error || !data) throw new Error(error?.message ?? "โหลดรายการรูนไม่สำเร็จ");
  return (data as DbRuneRow[]).map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", icon: r.icon_url ?? "" }));
}

let arcanaPromise: Promise<ArcanaSummary[]> | null = null;

// All runes (30 rows, with icons). Offline/mock mode has none — the UI falls back to initials.
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

// สกิล/พลังแฝงจะแสดงให้ผู้ใช้เฉพาะรายการที่ active/seasonal และแอดมินยืนยันกับเกมแล้ว (verified_at) — test_server/inactive/ยังไม่ยืนยัน จะไม่ถูกแสดง
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const publicOk = (x: any): boolean => !!x && (x.status === "active" || x.status === "seasonal") && !!x.verified_at;

const SOURCE_ORDER: Record<HeroBuild["source"], number> = { top_server: 0, curated: 1, heuristic: 2 };

// บิลด์ที่แอดมินสร้างใน Supabase (item_builds + item_build_items + item_build_rune)
// คืนทุกบิลด์ของฮีโร่ เรียง top_server (ตามอันดับ) → curated แล้วแพตช์ใหม่สุดก่อน; ไม่มีบิลด์ = [] ส่วนดึงไม่สำเร็จ throw
async function fetchDbBuilds(hero: Pick<HeroSummary, "id" | "slug">): Promise<HeroBuild[]> {
  const { data, error } = await supabase
    .from("item_builds")
    .select(
      "id, created_at, source, server_rank, captured_at, source_note, patches(code, released_at), rune(name, description, icon_url, color), item_build_items(phase, reason, sort_order, items(slug)), item_build_rune(quantity, reason, sort_order, rune(name, description, icon_url, color)), challenger_spells(slug, name, name_th, description, cooldown_seconds, status, icon_url, verified_at), item_build_enchantments(selection_type, sort_order, enchantments(slug, name, name_th, description, tier_level, category, status, icon_url, verified_at))"
    )
    .eq("hero_id", hero.id);
  if (error || !data) throw new Error(error?.message ?? "โหลดบิลด์ไม่สำเร็จ");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[]).filter((r) => (r.item_build_items ?? []).length > 0);
  rows.sort(
    (a, b) =>
      SOURCE_ORDER[a.source as HeroBuild["source"]] - SOURCE_ORDER[b.source as HeroBuild["source"]] ||
      (a.server_rank ?? 99) - (b.server_rank ?? 99) ||
      String(b.patches?.released_at ?? "").localeCompare(String(a.patches?.released_at ?? ""))
  );
  return rows.flatMap((r) => {
    const b = parseDbBuild(hero, r);
    return b ? [b] : [];
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDbBuild(hero: Pick<HeroSummary, "slug">, r: any): HeroBuild | null {
  const items: HeroBuild["items"] = [...r.item_build_items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .filter((i) => i.items?.slug)
    .map((i) => ({ itemSlug: i.items.slug as string, reason: i.reason as string, phase: i.phase as HeroBuild["items"][number]["phase"] }));
  if (items.length === 0) return null;

  // รูนหลายตัว (มีสี + จำนวน) จาก item_build_rune; ถ้าไม่มีใช้รูนชุดเดียวแบบเดิมจาก item_builds.rune_id
  const multi: BuildArcanaEntry[] = [...(r.item_build_rune ?? [])]
    .filter((a) => a.rune?.name)
    .sort(
      (a, b) =>
        (COLOR_ORDER[a.rune.color as ArcanaColor] ?? 9) - (COLOR_ORDER[b.rune.color as ArcanaColor] ?? 9) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )
    .map((a) => ({
      name: a.rune.name as string,
      reason: (a.reason ?? a.rune.description ?? "") as string,
      icon: a.rune.icon_url ?? undefined,
      color: (a.rune.color ?? undefined) as ArcanaColor | undefined,
      quantity: a.quantity as number,
    }));
  const legacy: BuildArcanaEntry[] = r.rune
    ? [{ name: r.rune.name, reason: r.rune.description ?? "", icon: r.rune.icon_url ?? undefined, color: r.rune.color ?? undefined }]
    : [];

  const sp = r.challenger_spells;
  const spell: BuildSpell | null = publicOk(sp)
    ? {
        slug: sp.slug,
        name: sp.name,
        nameTh: sp.name_th,
        description: sp.description ?? "",
        cooldownSeconds: sp.cooldown_seconds ?? null,
        status: sp.status,
        icon: sp.icon_url ?? undefined,
      }
    : null;

  const enchantments: BuildEnchantment[] = [...(r.item_build_enchantments ?? [])]
    .filter((e) => publicOk(e.enchantments))
    .sort(
      (a, b) =>
        (a.selection_type === "primary" ? 0 : 1) - (b.selection_type === "primary" ? 0 : 1) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )
    .map((e) => ({
      slug: e.enchantments.slug,
      name: e.enchantments.name,
      nameTh: e.enchantments.name_th,
      description: e.enchantments.description ?? "",
      tier: e.enchantments.tier_level ?? null,
      category: e.enchantments.category,
      status: e.enchantments.status,
      icon: e.enchantments.icon_url ?? undefined,
      type: e.selection_type as "primary" | "secondary",
    }));

  return {
    heroSlug: hero.slug,
    items,
    arcana: multi.length > 0 ? multi : legacy,
    patch: r.patches?.code ?? "N/A",
    source: r.source,
    id: r.id as string,
    createdAt: r.created_at as string,
    serverRank: r.server_rank ?? null,
    capturedAt: r.captured_at ?? null,
    sourceNote: r.source_note ?? null,
    spell,
    enchantments,
  };
}

// ทุกบิลด์ของฮีโร่จาก DB (ใช้หน้า Hero Detail) — [] ถ้าไม่มี (ไม่ cache ผลว่าง) / throw ถ้าดึงไม่สำเร็จ
export async function getBuildsForHero(hero: Pick<HeroSummary, "id" | "slug">): Promise<HeroBuild[]> {
  if (!isSupabaseConfigured) return [];
  const list = await cached(`builds:${hero.id}`, CACHE_TTL_MS, () => fetchDbBuilds(hero), (v) => v.length > 0);
  return list.map((b) => ({ ...b }));
}

// รหัสแพตช์ล่าสุดจากตาราง patches (ไว้เทียบว่าบิลด์เก่ากว่าแพตช์ปัจจุบันไหม); null = ไม่ทราบ
export function getLatestPatchCode(): Promise<string | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  return cached(
    "patch:latest",
    CACHE_TTL_MS,
    async () => {
      const { data, error } = await supabase
        .from("patches")
        .select("code")
        .order("released_at", { ascending: false, nullsFirst: false })
        .limit(1);
      if (error || !data?.length) return null;
      return (data[0] as { code: string }).code;
    },
    (v) => v !== null
  );
}

export async function getBuildForHero(hero: HeroSummary): Promise<HeroBuild> {
  // ดึงไม่สำเร็จ = ใช้ fallback เดิมเงียบๆ (พฤติกรรมของหน้า Item Build ไม่เปลี่ยน)
  const [db] = await getBuildsForHero(hero).catch(() => [] as HeroBuild[]);
  if (db) return db;
  return delay(MOCK_BUILDS[hero.slug] ?? genericBuildFor(hero));
}
