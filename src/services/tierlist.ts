/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getLatestPatch } from "@/services/meta";
import type { RankBucket } from "@/lib/rank";
import type { HeroLane, Tier } from "@/types/hero";

// ตารางที่ตั้งค่าแบบ config ในหน้า Admin (tier_lists + tier_list_entries) ไม่อยู่ใน type ของ client จึงใช้แบบ untyped
const db: any = supabase;

/** key ของลิสต์รวมทุกเลน (tier_lists.lane = null) */
export const ALL_LANES = "all";

/** lane (หรือ "all") → (hero_id → tier) */
export type CuratedTierLists = Map<string, Map<string, Tier>>;

/**
 * Tier ที่แอดมินจัดเองในแท็บ "Tier List" ของหน้า Admin ของแพตช์ล่าสุด + แรงก์ที่เลือก ครบทุกเลนในครั้งเดียว
 * คืน null เมื่อยังไม่มีลิสต์เลย (หรืออ่านไม่ได้) เพื่อให้ฝั่งเว็บ fallback ไปใช้ hero_stats.tier
 */
export async function getCuratedTierLists(rank: RankBucket): Promise<CuratedTierLists | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const patch = await getLatestPatch();
    if (!patch) return null;

    const { data: lists, error: listErr } = await db
      .from("tier_lists")
      .select("id, lane")
      .eq("patch_id", patch.id)
      .eq("rank_tier", rank);
    if (listErr || !lists || lists.length === 0) return null;

    const { data: entries, error } = await db
      .from("tier_list_entries")
      .select("tier_list_id, hero_id, tier")
      .in(
        "tier_list_id",
        lists.map((l: any) => l.id)
      );
    if (error || !entries || entries.length === 0) return null;

    const laneOfList = new Map<string, string>(lists.map((l: any) => [l.id as string, (l.lane as string | null) ?? ALL_LANES]));
    const out: CuratedTierLists = new Map();
    for (const e of entries as any[]) {
      const lane = laneOfList.get(e.tier_list_id);
      if (!lane) continue;
      let m = out.get(lane);
      if (!m) {
        m = new Map();
        out.set(lane, m);
      }
      m.set(e.hero_id as string, e.tier as Tier);
    }
    return out.size > 0 ? out : null;
  } catch {
    return null;
  }
}

/** ลิสต์ของเลนเดียว (lane = null → ลิสต์รวม) ใช้ในหน้า Tier List */
export async function getCuratedTiers(rank: RankBucket, lane: HeroLane | null): Promise<Map<string, Tier> | null> {
  const lists = await getCuratedTierLists(rank);
  return lists?.get(lane ?? ALL_LANES) ?? null;
}
