import { supabase } from "@/lib/supabase";
import type { Phase, ViewBuild } from "@/features/build/buildView";
import { toReaction, type Reaction } from "@/features/community/reactions";

// บิลด์ของผู้ใช้ (Build ของฉัน) และ Community Build (บิลด์ที่เผยแพร่แล้ว)
// สิทธิ์บังคับที่ RLS ของตาราง user_builds*; การบันทึกทำผ่าน RPC save_user_build (ทำใน transaction เดียว)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export interface BuildAuthor {
  id: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface UserBuild {
  id: string;
  ownerId: string;
  hero: { id: string; slug: string; name: string; nameTh: string; icon: string };
  name: string;
  note: string;
  isPublic: boolean;
  hidden: boolean;
  publishedAt: string | null;
  updatedAt: string;
  spellId: string | null;
  view: ViewBuild;
  ids: {
    items: { itemId: string; phase: Phase; sort: number }[];
    runes: { runeId: string; quantity: number; sort: number }[];
    enchants: { id: string; type: "primary" | "secondary" }[];
  };
  author: BuildAuthor | null;
  // ถูกใจ / ไม่ถูกใจ (user_build_reactions) — เติมโดย withStats; 0 เมื่อยังไม่มีข้อมูล
  likes: number;
  dislikes: number;
  myValue: Reaction;
}

const SELECT =
  "id, owner_id, hero_id, name, note, is_public, hidden, published_at, updated_at, challenger_spell_id, " +
  "heroes(slug, name, name_th, icon_url), " +
  "challenger_spells(id, slug, name, name_th, icon_url, cooldown_seconds), " +
  "user_build_items(item_id, phase, sort_order, items(slug, name, name_th, icon_url)), " +
  "user_build_runes(rune_id, quantity, sort_order, rune(id, name, icon_url, color, description)), " +
  "user_build_enchantments(enchantment_id, selection_type, sort_order, enchantments(slug, name, name_th, icon_url, tier_level))";

const PHASE_ORDER: Record<string, number> = { early: 0, core: 1, situational: 2 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(r: any): UserBuild {
  const items = [...(r.user_build_items ?? [])]
    .filter((i) => i.items?.slug)
    .sort((a, b) => (PHASE_ORDER[a.phase] ?? 9) - (PHASE_ORDER[b.phase] ?? 9) || a.sort_order - b.sort_order);
  const runes = [...(r.user_build_runes ?? [])].filter((x) => x.rune?.name).sort((a, b) => a.sort_order - b.sort_order);
  const ench = [...(r.user_build_enchantments ?? [])]
    .filter((e) => e.enchantments?.slug)
    .sort((a, b) => (a.selection_type === b.selection_type ? a.sort_order - b.sort_order : a.selection_type === "primary" ? -1 : 1));
  const sp = r.challenger_spells;
  return {
    id: r.id,
    ownerId: r.owner_id,
    hero: { id: r.hero_id, slug: r.heroes?.slug ?? "", name: r.heroes?.name ?? "", nameTh: r.heroes?.name_th ?? "", icon: r.heroes?.icon_url ?? "" },
    name: r.name,
    note: r.note ?? "",
    isPublic: r.is_public,
    hidden: r.hidden,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    spellId: r.challenger_spell_id ?? null,
    view: {
      items: items.map((i) => ({ slug: i.items.slug, name: i.items.name, icon: i.items.icon_url ?? undefined, phase: i.phase as Phase })),
      runes: runes.map((x) => ({ key: x.rune.id, name: x.rune.name, icon: x.rune.icon_url ?? undefined, color: x.rune.color ?? undefined, quantity: x.quantity, description: x.rune.description ?? undefined })),
      spell: sp ? { slug: sp.slug, name: sp.name, nameTh: sp.name_th, icon: sp.icon_url ?? undefined, cooldownSeconds: sp.cooldown_seconds ?? null } : null,
      enchantments: ench.map((e) => ({
        slug: e.enchantments.slug,
        name: e.enchantments.name,
        nameTh: e.enchantments.name_th,
        icon: e.enchantments.icon_url ?? undefined,
        tier: e.enchantments.tier_level ?? null,
        type: e.selection_type as "primary" | "secondary",
      })),
    },
    ids: {
      items: items.map((i) => ({ itemId: i.item_id, phase: i.phase as Phase, sort: i.sort_order })),
      runes: runes.map((x) => ({ runeId: x.rune_id, quantity: x.quantity, sort: x.sort_order })),
      enchants: ench.map((e) => ({ id: e.enchantment_id, type: e.selection_type as "primary" | "secondary" })),
    },
    author: null,
    likes: 0,
    dislikes: 0,
    myValue: 0,
  };
}

async function withAuthors(list: UserBuild[]): Promise<UserBuild[]> {
  const ids = [...new Set(list.map((b) => b.ownerId))];
  if (ids.length === 0) return list;
  const { data } = await db.rpc("get_public_authors", { p_ids: ids });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, BuildAuthor>(((data ?? []) as any[]).map((a) => [a.id, { id: a.id, handle: a.handle, displayName: a.display_name, avatarUrl: a.avatar_url }]));
  return list.map((b) => ({ ...b, author: byId.get(b.ownerId) ?? null }));
}

// จำนวนถูกใจ/ไม่ถูกใจ + ค่าที่ผู้ใช้กดไว้ (RPC get_user_build_reaction_stats) — ถ้าเรียกไม่สำเร็จให้แสดงบิลด์ต่อได้ (นับเป็น 0)
async function withStats(list: UserBuild[]): Promise<UserBuild[]> {
  const ids = list.filter((b) => b.isPublic && !b.hidden).map((b) => b.id);
  if (ids.length === 0) return list;
  const { data, error } = await db.rpc("get_user_build_reaction_stats", { p_ids: ids });
  if (error) return list;
  const byId = new Map<string, { likes: number; dislikes: number; myValue: Reaction }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((data ?? []) as any[]).map((s) => [s.build_id, { likes: s.like_count ?? 0, dislikes: s.dislike_count ?? 0, myValue: toReaction(s.my_value) }])
  );
  return list.map((b) => ({ ...b, ...(byId.get(b.id) ?? {}) }));
}

export async function listCommunityBuilds(heroId: string, limit = 30): Promise<UserBuild[]> {
  const { data, error } = await db
    .from("user_builds")
    .select(SELECT)
    .eq("hero_id", heroId)
    .eq("is_public", true)
    .eq("hidden", false)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return withStats(await withAuthors((data ?? []).map(map)));
}

export async function listMyBuilds(userId: string): Promise<UserBuild[]> {
  const { data, error } = await db.from("user_builds").select(SELECT).eq("owner_id", userId).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withStats((data ?? []).map(map));
}

// คืน null เมื่อไม่พบหรือมองไม่เห็น (private/ถูกซ่อน) — RLS กรองให้แล้ว
export async function getBuild(id: string): Promise<UserBuild | null> {
  const { data, error } = await db.from("user_builds").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const b = map(data);
  return (await withStats(await withAuthors([b])))[0];
}

export interface SaveArgs {
  id: string | null;
  heroId: string;
  name: string;
  note: string;
  spellId: string | null;
  isPublic: boolean;
  items: { item_id: string; phase: Phase }[];
  runes: { rune_id: string; quantity: number }[];
  enchantments: { enchantment_id: string; selection_type: "primary" | "secondary" }[];
}

export async function saveBuild(a: SaveArgs): Promise<string> {
  const { data, error } = await db.rpc("save_user_build", {
    p_id: a.id,
    p_hero_id: a.heroId,
    p_name: a.name,
    p_note: a.note.trim() === "" ? null : a.note,
    p_spell_id: a.spellId,
    p_is_public: a.isPublic,
    p_items: a.items,
    p_runes: a.runes,
    p_enchantments: a.enchantments,
  });
  if (error) throw error;
  return data as string;
}

export async function setBuildPublic(id: string, isPublic: boolean) {
  const { error } = await db.from("user_builds").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

// แอดมินเท่านั้น (trigger ใน DB บังคับ)
export async function setBuildHidden(id: string, hidden: boolean) {
  const { error } = await db.from("user_builds").update({ hidden }).eq("id", id);
  if (error) throw error;
}

export async function deleteBuild(id: string) {
  const { error } = await db.from("user_builds").delete().eq("id", id);
  if (error) throw error;
}

/** value 0 = ยกเลิกที่กดไว้ หนึ่งแถวต่อ (บิลด์, ผู้ใช้): สลับ like <-> dislike เป็น upsert (เหมือน reactToTierList) */
export async function reactToBuild(buildId: string, userId: string, value: Reaction): Promise<void> {
  if (value === 0) {
    const { error } = await db.from("user_build_reactions").delete().eq("build_id", buildId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("user_build_reactions").upsert({ build_id: buildId, user_id: userId, value }, { onConflict: "build_id,user_id" });
  if (error) throw error;
}

const KNOWN = new Set(["PROFANITY_BLOCKED", "ACCOUNT_SUSPENDED", "BUILD_LIMIT", "UNVERIFIED_REFERENCE", "RUNE_LIMIT", "TOO_MANY", "FORBIDDEN"]);

export function buildError(e: unknown, fallback = "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"): string {
  const err = e as { message?: string; details?: string; code?: string } | null;
  if (err?.details && KNOWN.has(err.details) && err.message) return err.message;
  if (err?.code === "42501") return "ต้องเข้าสู่ระบบก่อน";
  if (err?.code === "P0002") return "ไม่พบบิลด์นี้ (อาจถูกลบแล้ว)";
  if (err?.code === "23505") return "มีรายการซ้ำกันในบิลด์";
  return fallback;
}
