import { MOCK_HERO_DETAILS, MOCK_HEROES } from "@/data/heroes.mock";
import type { HeroAbility, HeroDetail, HeroLane, HeroRole, HeroSummary, Tier, CounterEntry, SynergyEntry } from "@/types/hero";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Live now that `heroes` is seeded in Supabase. hero_stats/hero_counters/hero_synergies
// are still empty (Admin panel will fill them), so every stat comes back with
// hasStats:false and counter/synergy lists come back empty until then — UI already
// renders "N/A" / empty-state for that case.

const EMPTY_STAT = { patch: "N/A", rankTier: "N/A", winRate: 0, pickRate: 0, banRate: 0, tier: "C" as Tier, matches: 0, hasStats: false };

type DbHeroRow = {
  id: string;
  slug: string;
  name: string;
  name_th: string;
  role: HeroRole;
  lane: HeroLane;
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
    nameTh: row.name_th,
    role: row.role,
    lane: row.lane,
    difficulty: row.difficulty,
    icon: row.icon_url ?? "",
    stat: statByHeroId.get(row.id) ?? EMPTY_STAT,
  };
}

async function fetchStatsByHeroId(heroIds: string[]): Promise<Map<string, HeroSummary["stat"]>> {
  const map = new Map<string, HeroSummary["stat"]>();
  if (heroIds.length === 0) return map;
  const { data, error } = await supabase
    .from("hero_stats")
    .select("hero_id, rank_tier, win_rate, pick_rate, ban_rate, tier, matches")
    .in("hero_id", heroIds);
  if (error || !data) return map; // hero_stats table not readable/empty — every hero falls back to EMPTY_STAT
  for (const row of data) {
    // if multiple rows exist per hero (different patch/rank), keep the first seen for now
    if (!map.has(row.hero_id)) {
      map.set(row.hero_id, {
        patch: "current",
        rankTier: row.rank_tier,
        winRate: Number(row.win_rate),
        pickRate: Number(row.pick_rate),
        banRate: Number(row.ban_rate),
        tier: row.tier as Tier,
        matches: Number(row.matches),
        hasStats: true,
      });
    }
  }
  return map;
}

export async function getHeroes(): Promise<HeroSummary[]> {
  if (!isSupabaseConfigured) return MOCK_HEROES;
  const { data, error } = await supabase
    .from("heroes")
    .select("id, slug, name, name_th, role, lane, difficulty, icon_url, description, strengths, weaknesses")
    .order("name_th", { ascending: true });
  if (error || !data) throw new Error(error?.message ?? "โหลดรายชื่อฮีโร่ไม่สำเร็จ");
  const statMap = await fetchStatsByHeroId(data.map((h) => h.id));
  return data.map((row) => toSummary(row as DbHeroRow, statMap));
}

function fallbackDetail(summary: HeroSummary, description: string | null, strengths: string[] | null, weaknesses: string[] | null): Omit<HeroDetail, "abilities" | "counteredBy" | "countersAgainst" | "synergies"> {
  return {
    ...summary,
    description: description ?? "ยังไม่มีคำอธิบายเชิงลึกสำหรับฮีโร่นี้ในระบบ",
    strengths: strengths ?? [],
    weaknesses: weaknesses ?? [],
  };
}

export async function getHeroBySlug(slug: string): Promise<HeroDetail | null> {
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
    .select("id, slug, name, name_th, role, lane, difficulty, icon_url, description, strengths, weaknesses")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const heroRow = row as DbHeroRow;
  const statMap = await fetchStatsByHeroId([heroRow.id]);
  const summary = toSummary(heroRow, statMap);
  const base = fallbackDetail(summary, heroRow.description, heroRow.strengths, heroRow.weaknesses);

  const [abilitiesRes, counteredByRes, countersAgainstRes, synergiesRes] = await Promise.all([
    supabase.from("hero_abilities").select("slot, name, description").eq("hero_id", heroRow.id).order("sort_order", { ascending: true }),
    supabase.from("hero_counters").select("strength, reason, lane_tip, counter_hero:heroes!hero_counters_counter_hero_id_fkey(slug, name_th)").eq("hero_id", heroRow.id),
    supabase.from("hero_counters").select("strength, reason, lane_tip, hero:heroes!hero_counters_hero_id_fkey(slug, name_th)").eq("counter_hero_id", heroRow.id),
    supabase.from("hero_synergies").select("reason, partner:heroes!hero_synergies_partner_hero_id_fkey(slug, name_th)").eq("hero_id", heroRow.id),
  ]);

  const abilities: HeroAbility[] = (abilitiesRes.data ?? []).map((a: any) => ({ slot: a.slot, name: a.name, description: a.description }));

  const counteredBy: CounterEntry[] = (counteredByRes.data ?? []).map((c: any) => ({
    heroSlug: c.counter_hero?.slug ?? "",
    heroNameTh: c.counter_hero?.name_th,
    strength: c.strength,
    reason: c.reason,
    laneTip: c.lane_tip ?? "",
  }));

  const countersAgainst: CounterEntry[] = (countersAgainstRes.data ?? []).map((c: any) => ({
    heroSlug: c.hero?.slug ?? "",
    heroNameTh: c.hero?.name_th,
    strength: c.strength,
    reason: c.reason,
    laneTip: c.lane_tip ?? "",
  }));

  const synergies: SynergyEntry[] = (synergiesRes.data ?? []).map((s: any) => ({
    heroSlug: s.partner?.slug ?? "",
    heroNameTh: s.partner?.name_th,
    reason: s.reason,
  }));

  return { ...base, abilities, counteredBy, countersAgainst, synergies };
}
