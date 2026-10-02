import { MOCK_HERO_DETAILS, MOCK_HEROES } from "@/data/heroes.mock";
import type { HeroAbility, HeroDetail, HeroLane, HeroRole, HeroSummary, Tier, CounterEntry, SynergyEntry } from "@/types/hero";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getRank, type RankBucket } from "@/lib/rank";
import { getLatestPatch } from "@/services/meta";

// Live Supabase data. hero_stats is read for the latest patch (patches.released_at)
// and the selected rank bucket ("all" | "high"); a hero with no row for that bucket
// gets EMPTY_STAT (UI shows N/A) — we never silently fall back to the other bucket.
// hero_counters holds, per hero, the top-3 heroes it beats (real in-game stats);
// it has no rank/patch column, so it is not affected by the rank toggle.
// hero_synergies is still empty.
//
// Hero names: the site shows the in-game English name everywhere (Thai translations
// can differ from the game and confuse players). The `nameTh` / `heroNameTh` properties
// are kept so existing components don't change, but they are now filled with the English
// `name` column. The `name_th` column is no longer read for display.

const EMPTY_STAT = { patch: "N/A", rankTier: "N/A", winRate: 0, pickRate: 0, banRate: 0, tier: "C" as Tier, matches: 0, hasStats: false };

const HERO_COLS = "id, slug, name, name_th, role, lane, roles, lanes, difficulty, icon_url, description, strengths, weaknesses";

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
  description: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
};

function toSummary(row: DbHeroRow, statByHeroId: Map<string, HeroSummary["stat"]>): HeroSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameTh: row.name, // display name = English in-game name
    role: row.role,
    lane: row.lane,
    roles: row.roles && row.roles.length > 0 ? row.roles : [row.role],
    lanes: row.lanes && row.lanes.length > 0 ? row.lanes : [row.lane],
    difficulty: row.difficulty,
    icon: row.icon_url ?? "",
    stat: statByHeroId.get(row.id) ?? EMPTY_STAT,
  };
}

async function fetchStatsByHeroId(heroIds: string[], rank: RankBucket): Promise<Map<string, HeroSummary["stat"]>> {
  const map = new Map<string, HeroSummary["stat"]>();
  if (heroIds.length === 0) return map;
  const patch = await getLatestPatch();
  let query = supabase
    .from("hero_stats")
    .select("hero_id, rank_tier, win_rate, pick_rate, ban_rate, tier, matches")
    .in("hero_id", heroIds)
    .eq("rank_tier", rank);
  if (patch) query = query.eq("patch_id", patch.id);
  const { data, error } = await query;
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

export async function getHeroes(rank: RankBucket = getRank()): Promise<HeroSummary[]> {
  if (!isSupabaseConfigured) return MOCK_HEROES;
  const { data, error } = await supabase
    .from("heroes")
    .select(HERO_COLS)
    .order("name", { ascending: true });
  if (error || !data) throw new Error(error?.message ?? "โหลดรายชื่อฮีโร่ไม่สำเร็จ");
  const rows = data as unknown as DbHeroRow[];
  const statMap = await fetchStatsByHeroId(rows.map((h) => h.id), rank);
  return rows.map((row) => toSummary(row, statMap));
}

function fallbackDetail(summary: HeroSummary, description: string | null, strengths: string[] | null, weaknesses: string[] | null): Omit<HeroDetail, "abilities" | "counteredBy" | "countersAgainst" | "synergies"> {
  return {
    ...summary,
    description: description ?? "ยังไม่มีคำอธิบายเชิงลึกสำหรับฮีโร่นี้ในระบบ",
    strengths: strengths ?? [],
    weaknesses: weaknesses ?? [],
  };
}

const STRENGTH_ORDER: Record<CounterEntry["strength"], number> = { best: 0, good: 1, situational: 2 };

// best -> good -> situational; ties keep the source ranking ("อันดับ 2" before "อันดับ 3").
function byStrength(a: CounterEntry, b: CounterEntry) {
  return STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || a.reason.localeCompare(b.reason);
}

export async function getHeroBySlug(slug: string, rank: RankBucket = getRank()): Promise<HeroDetail | null> {
  if (!isSupabaseConfigured) {
    const summary = MOCK_HEROES.find((h) => h.slug === slug);
    if (!summary) return null;
    return (
      MOCK_HERO_DETAILS[slug] ?? {
        ...summary,
        description: "ยังไม่มีคำอธิบายเชิงลึกสำหรับฮีโร่นี้ในระบบ",
        strengths: [],
        weaknesses: [],
        abilities: [],
        counteredBy: [],
        countersAgainst: [],
        synergies: [],
      }
    );
  }

  const { data: row, error } = await supabase
    .from("heroes")
    .select(HERO_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const heroRow = row as unknown as DbHeroRow;
  const statMap = await fetchStatsByHeroId([heroRow.id], rank);
  const summary = toSummary(heroRow, statMap);
  const base = fallbackDetail(summary, heroRow.description, heroRow.strengths, heroRow.weaknesses);

  const [abilitiesRes, counteredByRes, countersAgainstRes, synergiesRes] = await Promise.all([
    supabase.from("hero_abilities").select("slot, name, description, icon_url").eq("hero_id", heroRow.id).order("sort_order", { ascending: true }),
    supabase.from("hero_counters").select("strength, reason, lane_tip, counter_hero:heroes!hero_counters_counter_hero_id_fkey(slug, name, icon_url)").eq("hero_id", heroRow.id),
    supabase.from("hero_counters").select("strength, reason, lane_tip, hero:heroes!hero_counters_hero_id_fkey(slug, name, icon_url)").eq("counter_hero_id", heroRow.id),
    supabase.from("hero_synergies").select("reason, partner:heroes!hero_synergies_partner_hero_id_fkey(slug, name, icon_url)").eq("hero_id", heroRow.id),
  ]);

  const abilities: HeroAbility[] = (abilitiesRes.data ?? []).map((a: any) => ({
    slot: a.slot,
    name: a.name,
    description: a.description,
    icon: a.icon_url ?? undefined,
  }));

  const counteredBy: CounterEntry[] = (counteredByRes.data ?? [])
    .map((c: any) => ({
      heroSlug: c.counter_hero?.slug ?? "",
      heroNameTh: c.counter_hero?.name,
      heroIcon: c.counter_hero?.icon_url ?? undefined,
      strength: c.strength,
      reason: c.reason,
      laneTip: c.lane_tip ?? "",
    }))
    .sort(byStrength);

  const countersAgainst: CounterEntry[] = (countersAgainstRes.data ?? [])
    .map((c: any) => ({
      heroSlug: c.hero?.slug ?? "",
      heroNameTh: c.hero?.name,
      heroIcon: c.hero?.icon_url ?? undefined,
      strength: c.strength,
      reason: c.reason,
      laneTip: c.lane_tip ?? "",
    }))
    .sort(byStrength);

  const synergies: SynergyEntry[] = (synergiesRes.data ?? []).map((s: any) => ({
    heroSlug: s.partner?.slug ?? "",
    heroNameTh: s.partner?.name,
    heroIcon: s.partner?.icon_url ?? undefined,
    reason: s.reason,
  }));

  return { ...base, abilities, counteredBy, countersAgainst, synergies };
}
