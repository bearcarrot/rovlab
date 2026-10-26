/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached, CACHE_TTL_MS } from "@/lib/ttlCache";
import { getLatestPatch } from "@/services/meta";
import type { RankBucket } from "@/lib/rank";
import type { HeroLane, Tier } from "@/types/hero";

// ตารางที่ตั้งค่าแบบ config ในหน้า Admin (tier_lists + tier_list_entries) ไม่อยู่ใน type ของ client จึงใช้แบบ untyped
const db: any = supabase;

/** key ของลิสต์รวมทุกเลน (tier_lists.lane = null) */
export const ALL_LANES = "all";

/** lane (หรือ "all") → (hero_id → tier) */
export type CuratedTierLists = Map<string, Map<string, Tier>>;

// แถวดิบเป็น JSON ล้วน (ไม่มี Map) เพื่อให้ ttlCache เก็บลง localStorage ข้ามการรีโหลดได้ แล้วค่อยประกอบเป็น Map ตอนอ่าน
// ok = false เมื่ออ่านไม่ได้/พลาด (ไม่เก็บใน cache) ต่างจาก "อ่านได้แต่ยังไม่มีลิสต์" ซึ่ง cache ได้
type Raw = {
  ok: boolean;
  lists: { id: string; lane: string | null }[];
  entries: { tier_list_id: string; hero_id: string; tier: Tier }[];
};

const none = (ok: boolean): Raw => ({ ok, lists: [], entries: [] });

// บันทึกสาเหตุไว้ใน console เท่านั้น (ไม่ส่งข้อความจาก DB ไปให้ผู้ใช้เห็น)
function fail(step: string, err?: unknown): Raw {
  console.warn(`[tierlist] ${step} failed`, err);
  return none(false);
}

async function loadRaw(rank: RankBucket): Promise<Raw> {
  if (!isSupabaseConfigured) return none(true);
  try {
    const patch = await getLatestPatch();
    // getLatestPatch คืน null ทั้งกรณี "ยังไม่มีแพตช์" และ "อ่านไม่ได้" แยกกันไม่ได้ จึงถือว่าพลาด (ไม่ cache)
    if (!patch) return fail("latest patch");

    const { data: lists, error: listErr } = await db
      .from("tier_lists")
      .select("id, lane")
      .eq("patch_id", patch.id)
      .eq("rank_tier", rank);
    if (listErr) return fail("tier_lists", listErr);
    if (!lists || lists.length === 0) return none(true);

    const { data: entries, error } = await db
      .from("tier_list_entries")
      .select("tier_list_id, hero_id, tier")
      .in(
        "tier_list_id",
        lists.map((l: any) => l.id)
      );
    if (error) return fail("tier_list_entries", error);
    return { ok: true, lists: lists as Raw["lists"], entries: (entries ?? []) as Raw["entries"] };
  } catch (e) {
    return fail("load", e);
  }
}

function build(raw: Raw): CuratedTierLists | null {
  const laneOfList = new Map<string, string>(raw.lists.map((l) => [l.id, l.lane ?? ALL_LANES]));
  const out: CuratedTierLists = new Map();
  for (const e of raw.entries) {
    const lane = laneOfList.get(e.tier_list_id);
    if (!lane) continue;
    let m = out.get(lane);
    if (!m) {
      m = new Map();
      out.set(lane, m);
    }
    m.set(e.hero_id, e.tier);
  }
  return out.size > 0 ? out : null;
}

const loadCached = (rank: RankBucket) => cached(`tiers:${rank}`, CACHE_TTL_MS, () => loadRaw(rank), (v) => v.ok);

/**
 * Tier ที่แอดมินจัดเองในแท็บ "Tier List" ของหน้า Admin ของแพตช์ล่าสุด + แรงก์ที่เลือก ครบทุกเลนในครั้งเดียว
 * คืน null เมื่อยังไม่มีลิสต์เลย (หรืออ่านไม่ได้) เพื่อให้ฝั่งเว็บ fallback ไปใช้ hero_stats.tier
 * แคช (หน่วยความจำ + localStorage, แอดมินข้าม cache) เก็บแถวดิบ; Map ที่คืนไปสร้างใหม่ทุกครั้ง
 * key ต้องขึ้นต้นด้วย "tiers:" เพราะโค้ดฝั่งแอดมินล้างแคชด้วย prefix นี้
 */
export async function getCuratedTierLists(rank: RankBucket): Promise<CuratedTierLists | null> {
  return build(await loadCached(rank));
}

/** ลิสต์ของเลนเดียว (lane = null → ลิสต์รวม) ใช้ในหน้า Tier List */
export async function getCuratedTiers(rank: RankBucket, lane: HeroLane | null): Promise<Map<string, Tier> | null> {
  const lists = await getCuratedTierLists(rank);
  return lists?.get(lane ?? ALL_LANES) ?? null;
}

/**
 * เหมือน getCuratedTiers แต่ "อ่านไม่ได้" จะ throw (null = อ่านได้แต่ไม่มีลิสต์ของเลนนี้จริง ๆ → fallback ได้)
 * ใช้ในหน้า Tier List เพื่อแสดงปุ่มลองใหม่ แทนการโชว์ hero_stats.tier เหมือนเป็นลิสต์ทีมงาน
 * ข้อความ error เป็นข้อความกลาง ๆ ไม่ใช้ข้อความจาก DB; ผลที่พลาดไม่ถูก cache จึงลองใหม่ได้
 */
export async function getCuratedTiersStrict(rank: RankBucket, lane: HeroLane | null): Promise<Map<string, Tier> | null> {
  const raw = await loadCached(rank);
  if (!raw.ok) throw new Error("ไม่สามารถโหลด Tier List ทางการได้");
  return build(raw)?.get(lane ?? ALL_LANES) ?? null;
}

/** ทุกเลนในครั้งเดียว แบบ strict (อ่านไม่ได้ = throw) ใช้ cache entry เดียวกับ getCuratedTiersStrict จึงไม่มีคำขอเพิ่ม */
export async function getCuratedTierListsStrict(rank: RankBucket): Promise<CuratedTierLists | null> {
  const raw = await loadCached(rank);
  if (!raw.ok) throw new Error("ไม่สามารถโหลด Tier List ทางการได้");
  return build(raw);
}
