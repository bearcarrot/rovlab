/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

let recentPromise: Promise<Map<string, BalanceKind>> | null = null;

// hero uuid -> ประเภทการปรับล่าสุดในช่วง RECENT_DAYS (โหลดครั้งเดียว แชร์ให้ทุกการ์ด)
export function getRecentBalance(): Promise<Map<string, BalanceKind>> {
  if (!isSupabaseConfigured) return Promise.resolve(new Map());
  if (!recentPromise) {
    recentPromise = (async () => {
      const map = new Map<string, BalanceKind>();
      const { data, error } = await supabase
        .from("hero_balance_changes")
        .select("hero_id, kind, changed_at")
        .gte("changed_at", cutoff())
        .order("changed_at", { ascending: false });
      if (error || !data) return map; // อ่านไม่ได้ = ไม่แสดงไอคอน (ไม่กระทบหน้าหลัก)
      for (const r of data as any[]) {
        if (!map.has(r.hero_id)) map.set(r.hero_id, r.kind as BalanceKind);
      }
      return map;
    })();
  }
  return recentPromise;
}

// การปรับของฮีโร่ตัวเดียว ใหม่สุดก่อน (สูงสุด 3 รายการ)
export async function getHeroBalance(heroId: string): Promise<BalanceChange[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("hero_balance_changes")
    .select("id, kind, tag, reason, skill_changes, changed_at, patches(code)")
    .eq("hero_id", heroId)
    .order("changed_at", { ascending: false })
    .limit(3);
  if (error || !data) return [];
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
