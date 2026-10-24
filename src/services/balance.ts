/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cached, CACHE_TTL_MS } from "@/lib/ttlCache";

// การปรับสมดุลฮีโร่ (บัฟ/เนิฟ/ปรับ/รีเวิร์ก) จากตาราง hero_balance_changes — แอดมินอัปโหลดไฟล์ getlatestadjustlist.json ที่ /admin

export type BalanceKind = "buff" | "nerf" | "adjust" | "rework";

export const BALANCE_LABEL: Record<BalanceKind, string> = {
  buff: "บัฟ",
  nerf: "เนิฟ",
  adjust: "ปรับสมดุล",
  rework: "รีเวิร์ก",
};

export interface BalanceSkillChange {
  slot: string;
  name: string;
  content: string; // "ก่อน → หลัง"
}

export interface BalanceChange {
  id: string;
  kind: BalanceKind;
  tag: string;
  reason: string;
  skills: BalanceSkillChange[];
  changedAt: string; // YYYY-MM-DD
  patch: string | null;
}

// ไอคอนบัฟ/เนิฟบนการ์ดฮีโร่แสดงเฉพาะการปรับที่ไม่เกินกี่วัน เพื่อไม่ให้เก่าค้างจนหลงทาง
export const RECENT_DAYS = 60;

const cutoff = () => new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);

// เก็บเป็น entries (JSON ล้วน) เพื่อให้ ttlCache เก็บลง localStorage ได้ แล้วสร้าง Map ใหม่ทุกครั้งที่อ่าน; null = อ่านไม่ได้ (ไม่ cache)
type RecentEntries = [string, BalanceKind][] | null;

async function loadRecent(): Promise<RecentEntries> {
  const { data, error } = await supabase
    .from("hero_balance_changes")
    .select("hero_id, kind, changed_at")
    .gte("changed_at", cutoff())
    .order("changed_at", { ascending: false });
  if (error || !data) return null; // อ่านไม่ได้ = ไม่แสดงไอคอน (ไม่กระทบหน้าหลัก) และลองใหม่ครั้งหน้า
  const map = new Map<string, BalanceKind>();
  for (const r of data as any[]) {
    if (!map.has(r.hero_id)) map.set(r.hero_id, r.kind as BalanceKind);
  }
  return Array.from(map);
}

// hero uuid -> ประเภทการปรับล่าสุดในช่วง RECENT_DAYS (โหลดครั้งเดียว แชร์ให้ทุกการ์ด และจำข้ามการรีโหลด)
export async function getRecentBalance(): Promise<Map<string, BalanceKind>> {
  if (!isSupabaseConfigured) return new Map();
  const entries = await cached("balance:recent", CACHE_TTL_MS, loadRecent, (v) => v !== null);
  return new Map(entries ?? []);
}

// การปรับของฮีโร่ตัวเดียว ใหม่สุดก่อน (สูงสุด 3 รายการ) — แคชในหน่วยความจำรายฮีโร่ (ไม่ persist); null = อ่านไม่ได้ (ไม่ cache)
async function loadHeroBalance(heroId: string): Promise<BalanceChange[] | null> {
  const { data, error } = await supabase
    .from("hero_balance_changes")
    .select("id, kind, tag, reason, skill_changes, changed_at, patches(code)")
    .eq("hero_id", heroId)
    .order("changed_at", { ascending: false })
    .limit(3);
  if (error || !data) return null;
  return (data as any[]).map((r) => ({
    id: r.id,
    kind: r.kind as BalanceKind,
    tag: r.tag ?? "",
    reason: r.reason ?? "",
    skills: Array.isArray(r.skill_changes) ? (r.skill_changes as BalanceSkillChange[]) : [],
    changedAt: r.changed_at,
    patch: r.patches?.code ?? null,
  }));
}

export async function getHeroBalance(heroId: string): Promise<BalanceChange[]> {
  if (!isSupabaseConfigured) return [];
  const list = await cached(`balance:hero:${heroId}`, CACHE_TTL_MS, () => loadHeroBalance(heroId), (v) => v !== null);
  return (list ?? []).map((c) => ({ ...c }));
}
