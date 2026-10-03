/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getLatestPatch } from "@/services/meta";
import type { RankBucket } from "@/lib/rank";
import type { HeroLane, Tier } from "@/types/hero";

// ตารางที่ตั้งค่าแบบ config ในหน้า Admin (tier_lists + tier_list_entries) ไม่อยู่ใน type ของ client จึงใช้แบบ untyped
const db: any = supabase;

/**
 * Tier ที่แอดมินจัดเองในแท็บ "Tier List" ของหน้า Admin
 * แต่ละลิสต์ผูกกับ (แพตช์ล่าสุด, แรงก์, เลน): lane = null คือลิสต์รวมทุกเลน
 * คืน Map hero_id → tier; คืน null เมื่อไม่มีลิสต์นั้น (หรืออ่านไม่ได้) เพื่อให้หน้าเว็บ fallback ไปใช้ hero_stats.tier
 */
export async function getCuratedTiers(rank: RankBucket, lane: HeroLane | null): Promise<Map<string, Tier> | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const patch = await getLatestPatch();
    if (!patch) return null;

    let listQ = db.from("tier_lists").select("id").eq("patch_id", patch.id).eq("rank_tier", rank);
    listQ = lane === null ? listQ.is("lane", null) : listQ.eq("lane", lane);
    const { data: list, error: listErr } = await listQ.limit(1).maybeSingle();
    if (listErr || !list) return null;

    const { data: entries, error } = await db
      .from("tier_list_entries")
      .select("hero_id, tier")
      .eq("tier_list_id", list.id);
    if (error || !entries || entries.length === 0) return null;

    return new Map<string, Tier>(entries.map((e: any) => [e.hero_id as string, e.tier as Tier]));
  } catch {
    return null;
  }
}
