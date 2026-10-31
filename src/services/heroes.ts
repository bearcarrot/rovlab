import type { HeroAbility, HeroDetail, HeroLane, HeroPhase, HeroRole, HeroSummary, Tier, CounterEntry, SynergyEntry } from "@/types/hero";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getRank, type RankBucket } from "@/lib/rank";
import { parseEffectTags } from "@/lib/effectTags";
import { cached, peek } from "@/lib/ttlCache";
import { relationsForHero } from "@/lib/heroRelations";
import { peekDraftRelations } from "@/services/draft";
import { getLatestPatch } from "@/services/meta";
import { ALL_LANES, getCuratedTierLists, type CuratedTierLists } from "@/services/tierlist";

// Live Supabase data. hero_stats is read for the latest patch (patches.released_at)
// and the selected rank bucket ("all" | "high"); a hero with no row for that bucket
// gets EMPTY_STAT (UI shows N/A) — we never silently fall back to the other bucket.
// hero_counters holds, per hero, the top-3 heroes it beats (real in-game stats);
// it has no rank/patch column, so it is not affected by the rank toggle.
// hero_synergies is still empty.
//
// Tier badges: `stat.tier` is the tier the admin set in the Admin "Tier List" tab, taken
// from the list of the hero's primary lane (heroes.lane) for the latest patch + selected
// rank, then the all-lanes list. hero_stats.tier (computed from win rate at import) is only
// the fallback for heroes that are in none of the admin's lists, or when no list exists.
//
// Hero names: the site shows the in-game English name everywhere (Thai translations
// can differ from the game and confuse players). The `nameTh` / `heroNameTh` properties
// are kept so existing components don't change, but they are now filled with the English
// `name` column. The `name_th` column is not used for display; it is exposed only as
// `thaiName` so the hero search boxes can also match Thai names (see lib/heroSearch.ts).
//
// Performance: the independent queries run in parallel, and results are cached in memory
// for CACHE_TTL_MS (see lib/ttlCache). Admins bypass the cache so their edits show up at once.

const CACHE_TTL_MS = 5 * 60 * 1000;

const EMPTY_STAT = { patch: "N/A", rankTier: "N/A", winRate: 0, pickRate: 0, banRate: 0, tier: "C" as Tier, matches: 0, hasStats: false };

// รายการฮีโร่ (HeroSummary) ไม่ใช้ description/strengths/weaknesses (~43 KB ต่อการโหลดหน้า) จึงไม่ดึงมา
// ต้องคงให้ตรงกับ select ของ get("heroes", …) ใน index.html ทุกตัวอักษร ไม่งั้นผล prefetch ถูกทิ้งและยิงซ้ำ
const HERO_LIST_COLS = "id, slug, name, name_th, role, lane, roles, lanes, difficulty, icon_url, phase";
// หน้ารายละเอียดฮีโร่ (1 แถว) ต้องใช้ข้อความเต็ม
const HERO_COLS = `${HERO_LIST_COLS}, description, strengths, weaknesses`;

type DbHeroRow = {
  id: string;
  slug: string;
  name: string;
  name_th: string;
  role: HeroRole;
  lane: HeroLane;
  roles: HeroRole[] | null;
  lanes: HeroLane[] | null;
  difficulty: "easy" | "medium" | "hard";
  icon_url: string | null;
  phase: HeroPhase | null;
  description: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
};

type DbHeroListRow = Omit<DbHeroRow, "description" | "strengths" | "weaknesses">;

function toSummary(row: DbHeroListRow, statByHeroId: Map<string, HeroSummary["stat"]>): HeroSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameTh: row.name, // display name = English in-game name
    thaiName: row.name_th || undefined, // search only, never displayed
    role: row.role,
    lane: row.lane,
    roles: row.roles && row.roles.length > 0 ? row.roles : [row.role],
    lanes: row.lanes && row.lanes.length > 0 ? row.lanes : [row.lane],
    difficulty: row.difficulty,
    phase: row.phase ?? undefined,
    icon: row.icon_url ?? "",
    stat: statByHeroId.get(row.id) ?? EMPTY_STAT,
  };
}

// heroIds = null → every hero's stat row for the latest patch + rank (used by the hero list)
// strict = true (หน้ารายละเอียดฮีโร่) → ถ้าหาแพตช์ล่าสุดไม่ได้หรือ query พลาด ให้ throw แทนการคืน N/A:
// ไม่งั้นผลที่ไม่จริงถูกแคช (5 นาทีในหน่วยความจำ / 15 นาทีใน localStorage) และถ้าไม่มีแพตช์ query จะไม่กรอง patch_id แล้วได้สถิติปนหลายแพตช์
async function fetchStatsByHeroId(heroIds: string[] | null, rank: RankBucket, strict = false): Promise<Map<string, HeroSummary["stat"]>> {
  const map = new Map<string, HeroSummary["stat"]>();
  if (heroIds && heroIds.length === 0) return map;
  const patch = await getLatestPatch();
  if (strict && !patch) throw new Error("โหลดสถิติฮีโร่ไม่สำเร็จ");
  let query = supabase
    .from("hero_stats")
    .select("hero_id, rank_tier, win_rate, pick_rate, ban_rate, tier, matches")
    .eq("rank_tier", rank);
  if (heroIds) query = query.in("hero_id", heroIds);
  if (patch) query = query.eq("patch_id", patch.id);
  const { data, error } = await query;
  if (strict && error) throw new Error(error.message);
  if (error || !data) return map; // not readable/empty — every hero falls back to EMPTY_STAT
  for (const row of data) {
    map.set(row.hero_id, {
      patch: patch?.code ?? "N/A",
      rankTier: row.rank_tier,
      winRate: Number(row.win_rate),
      pickRate: Number(row.pick_rate),
      banRate: Number(row.ban_rate),
      tier: row.tier as Tier,
      matches: Number(row.matches),
      hasStats: true,
    });
  }
  return map;
}

// ทับ stat.tier ด้วย tier ที่แอดมินจัดเอง: ลิสต์ของเลนหลักของฮีโร่ก่อน รองลงมาคือลิสต์รวม ไม่มีทั้งสองค่อยใช้ค่าจาก hero_stats
function applyCuratedTiers(list: HeroSummary[], lists: CuratedTierLists | null): HeroSummary[] {
  if (!lists) return list;
  return list.map((h) => {
    if (!h.stat.hasStats) return h;
    const tier = lists.get(h.lane)?.get(h.id) ?? lists.get(ALL_LANES)?.get(h.id);
    return tier ? { ...h, stat: { ...h.stat, tier } } : h;
  });
}

// withCurated = false → ไม่ query tier_lists / tier_list_entries; stat.tier เป็นค่าดิบจาก hero_stats (ใช้เฉพาะ getHeroesForStats)
async function loadHeroes(rank: RankBucket, withCurated = true): Promise<HeroSummary[]> {
  if (!isSupabaseConfigured) return [];
  const [heroesRes, statMap, curated] = await Promise.all([
    supabase.from("heroes").select(HERO_LIST_COLS).order("name", { ascending: true }),
    fetchStatsByHeroId(null, rank),
    withCurated ? getCuratedTierLists(rank) : null,
  ]);
  const { data, error } = heroesRes;
  if (error || !data) throw new Error(error?.message ?? "โหลดรายชื่อฮีโร่ไม่สำเร็จ");
  const rows = data as unknown as DbHeroListRow[];
  return applyCuratedTiers(rows.map((row) => toSummary(row, statMap)), curated);
}

// Minimal hero fields for places that only show a few icons (e.g. a public profile's favourite heroes).
// One small query on `heroes` instead of loading every hero + stats + tier lists.
export type HeroChip = { id: string; slug: string; name: string; icon: string };

export async function getHeroChipsByIds(ids: string[]): Promise<HeroChip[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  if (!isSupabaseConfigured) return [];
  return cached(`heroChips:${[...unique].sort().join(",")}`, CACHE_TTL_MS, async () => {
    const { data, error } = await supabase.from("heroes").select("id, slug, name, icon_url").in("id", unique);
    if (error) throw new Error(error.message);
    const byId = new Map((data ?? []).map((r: any) => [r.id as string, r]));
    // keep the profile's own order
    return unique
      .map((id) => byId.get(id))
      .filter((r): r is any => !!r)
      .map((r) => ({ id: r.id as string, slug: r.slug as string, name: r.name as string, icon: (r.icon_url as string | null) ?? "" }));
  });
}

export function getHeroes(rank: RankBucket = getRank()): Promise<HeroSummary[]> {
  // slice(): callers may sort the array in place; never hand out the cached instance itself
  return cached(`heroes:${rank}`, CACHE_TTL_MS, () => loadHeroes(rank)).then((list) => list.slice());
}

// หน้า Stats ไม่แสดง stat.tier จึงไม่ดึง tier_lists: ใช้ list เต็มที่อุ่นอยู่แล้วก่อน ไม่มีค่อยโหลดแบบไม่มี curated
// key "heroes-stats:" ต้องแยกจาก "heroes:<rank>" (ไม่ persist) ไม่งั้น loadHeroBySlug จะ peek เจอ list ที่ tier ไม่ถูกทับ
export function getHeroesForStats(rank: RankBucket = getRank()): Promise<HeroSummary[]> {
  const full = peek<HeroSummary[]>(`heroes:${rank}`, CACHE_TTL_MS);
  if (full) return Promise.resolve(full.slice());
  return cached(`heroes-stats:${rank}`, CACHE_TTL_MS, () => loadHeroes(rank, false)).then((list) => list.slice());
}

function fallbackDetail(summary: HeroSummary, description: string | null, strengths: string[] | null, weaknesses: string[] | null): Omit<HeroDetail, "abilities" | "counteredBy" | "countersAgainst" | "synergies"> {
  return {
    ...summary,
    description: description ?? "",
    strengths: strengths ?? [],
    weaknesses: weaknesses ?? [],
  };
}

const STRENGTH_ORDER: Record<CounterEntry["strength"], number> = { best: 0, good: 1, situational: 2 };

// best -> good -> situational; ties keep the source ranking ("อันดับ 2" before "อันดับ 3").
function byStrength(a: CounterEntry, b: CounterEntry) {
  return STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || a.reason.localeCompare(b.reason);
}

async function loadHeroBySlug(slug: string, rank: RankBucket): Promise<HeroDetail | null> {
  if (!isSupabaseConfigured) return null;

  // array shape (not .maybeSingle()) so the read can go through the CDN-cached /api/sb proxy; slug is unique
  const { data: rows, error } = await supabase.from("heroes").select(HERO_COLS).eq("slug", slug).limit(1);
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row) return null;

  const heroRow = row as unknown as DbHeroRow;

  // Reuse what other pages already cached (no extra request): the hero list carries this hero's stat + curated tier,
  // and draft-relations carries every counter/synergy row. Anything missing falls back to the per-hero queries.
  const list = peek<HeroSummary[]>(`heroes:${rank}`, CACHE_TTL_MS);
  const listed = list?.find((h) => h.id === heroRow.id);
  const allRel = peekDraftRelations();
  const local = allRel && list ? relationsForHero(heroRow.id, allRel, list) : null;

  // everything below only needs the hero id, so run it all at once
  const [statMap, curated, abilitiesRes, remote] = await Promise.all([
    listed ? null : fetchStatsByHeroId([heroRow.id], rank, true),
    listed ? null : getCuratedTierLists(rank),
    supabase.from("hero_abilities").select("slot, name, description, icon_url, effect_tags").eq("hero_id", heroRow.id).order("sort_order", { ascending: true }),
    local
      ? null
      : Promise.all([
          supabase.from("hero_counters").select("strength, reason, lane_tip, counter_hero:heroes!hero_counters_counter_hero_id_fkey(slug, name, icon_url)").eq("hero_id", heroRow.id),
          supabase.from("hero_counters").select("strength, reason, lane_tip, hero:heroes!hero_counters_hero_id_fkey(slug, name, icon_url)").eq("counter_hero_id", heroRow.id),
          supabase.from("hero_synergies").select("reason, partner:heroes!hero_synergies_partner_hero_id_fkey(slug, name, icon_url)").eq("hero_id", heroRow.id),
        ]),
  ]);

  // อย่ากลืน error ของ query ย่อย: ไม่งั้นหน้าจะขึ้น "ยังไม่มีข้อมูล" ทั้งที่จริงโหลดไม่สำเร็จ (และถูกแคชไว้)
  for (const res of [abilitiesRes, ...(remote ?? [])]) {
    if (res.error) throw new Error(res.error.message);
  }
  const [counteredByRes, countersAgainstRes, synergiesRes] = remote ?? [];

  const summary = listed ? { ...listed } : applyCuratedTiers([toSummary(heroRow, statMap ?? new Map())], curated ?? null)[0];
  const base = fallbackDetail(summary, heroRow.description, heroRow.strengths, heroRow.weaknesses);

  const abilities: HeroAbility[] = (abilitiesRes.data ?? []).map((a: any) => ({
    slot: a.slot,
    name: a.name,
    description: a.description,
    icon: a.icon_url ?? undefined,
    effectTags: parseEffectTags(a.effect_tags),
  }));

  const counteredBy: CounterEntry[] = local ? local.counteredBy.sort(byStrength) : (counteredByRes?.data ?? [])
    .map((c: any) => ({
      heroSlug: c.counter_hero?.slug ?? "",
      heroNameTh: c.counter_hero?.name,
      heroIcon: c.counter_hero?.icon_url ?? undefined,
      strength: c.strength,
      reason: c.reason,
      laneTip: c.lane_tip ?? "",
    }))
    .filter((c) => c.heroSlug)
    .sort(byStrength);

  const countersAgainst: CounterEntry[] = local ? local.countersAgainst.sort(byStrength) : (countersAgainstRes?.data ?? [])
    .map((c: any) => ({
      heroSlug: c.hero?.slug ?? "",
      heroNameTh: c.hero?.name,
      heroIcon: c.hero?.icon_url ?? undefined,
      strength: c.strength,
      reason: c.reason,
      laneTip: c.lane_tip ?? "",
    }))
    .filter((c) => c.heroSlug)
    .sort(byStrength);

  const synergies: SynergyEntry[] = local ? local.synergies : (synergiesRes?.data ?? []).map((s: any) => ({
    heroSlug: s.partner?.slug ?? "",
    heroNameTh: s.partner?.name,
    heroIcon: s.partner?.icon_url ?? undefined,
    reason: s.reason,
  })).filter((s) => s.heroSlug);

  return { ...base, abilities, counteredBy, countersAgainst, synergies };
}

export function getHeroBySlug(slug: string, rank: RankBucket = getRank()): Promise<HeroDetail | null> {
  return cached(`hero:${slug}:${rank}`, CACHE_TTL_MS, () => loadHeroBySlug(slug, rank)).then((d) => (d ? { ...d } : d));
}
