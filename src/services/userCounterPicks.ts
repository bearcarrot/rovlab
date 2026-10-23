import { supabase } from "@/lib/supabase";
import type { CounterStrength } from "@/services/draft";

// Counter Pick ของฉัน (ตาราง user_counter_picks): ข้อมูลส่วนตัวของบัญชีเดียว
// สิทธิ์บังคับที่ RLS + trigger ใน DB (ดู supabase/migrations/20261023_user_counter_picks.sql) UI ไม่ได้เป็นด่านป้องกันเอง

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export interface UserCounterPick {
  id: string;
  enemyHeroId: string; // ฮีโร่ศัตรูที่โดนเคาน์เตอร์ (เหมือน hero_counters.hero_id)
  counterHeroId: string; // ฮีโร่ที่ผู้ใช้เลือกสู้
  strength: CounterStrength;
  reason: string;
  updatedAt: string;
}

export const REASON_MAX = 300;
const COLS = "id, enemy_hero_id, counter_hero_id, strength, reason, updated_at";
// หนึ่งบัญชีมีได้ไม่เกิน 300 แถว (trigger ใน DB) ดึงครั้งเดียวได้หมด
const LIMIT = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(r: any): UserCounterPick {
  return {
    id: r.id,
    enemyHeroId: r.enemy_hero_id,
    counterHeroId: r.counter_hero_id,
    strength: r.strength,
    reason: r.reason ?? "",
    updatedAt: r.updated_at,
  };
}

// ไม่ส่ง owner_id ในการอ่าน: RLS กรองให้เฉพาะแถวของผู้ใช้ที่ล็อกอินอยู่ (guest ได้รายการว่าง)
export async function listMyCounterPicks(): Promise<UserCounterPick[]> {
  const { data, error } = await db.from("user_counter_picks").select(COLS).order("updated_at", { ascending: false }).limit(LIMIT);
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => map(r));
}

export interface CreateCounterPicksArgs {
  ownerId: string;
  enemyHeroId: string;
  counterHeroIds: string[];
  strength: CounterStrength;
  reason: string;
}

// เลือกฮีโร่ที่สู้ได้หลายตัวในครั้งเดียว = หลายแถว (ชุดเดียวกัน insert พร้อมกัน ถ้าซ้ำกับของเดิมทั้งชุดไม่ถูกบันทึก)
export async function createCounterPicks(a: CreateCounterPicksArgs): Promise<void> {
  const reason = a.reason.trim() === "" ? null : a.reason.trim();
  const rows = [...new Set(a.counterHeroIds)].map((counter) => ({
    owner_id: a.ownerId,
    enemy_hero_id: a.enemyHeroId,
    counter_hero_id: counter,
    strength: a.strength,
    reason,
  }));
  if (rows.length === 0) return;
  const { error } = await db.from("user_counter_picks").insert(rows);
  if (error) throw error;
}

// แก้ได้เฉพาะระดับและเหตุผล: เปลี่ยนคู่ฮีโร่ = ลบแล้วสร้างใหม่ (กันชนกับกฎห้ามซ้ำ)
export async function updateCounterPick(id: string, patch: { strength: CounterStrength; reason: string }): Promise<void> {
  const reason = patch.reason.trim() === "" ? null : patch.reason.trim();
  const { error } = await db.from("user_counter_picks").update({ strength: patch.strength, reason }).eq("id", id);
  if (error) throw error;
}

export async function deleteCounterPick(id: string): Promise<void> {
  const { error } = await db.from("user_counter_picks").delete().eq("id", id);
  if (error) throw error;
}

const KNOWN = new Set(["PROFANITY_BLOCKED", "ACCOUNT_SUSPENDED", "COUNTER_LIMIT", "FORBIDDEN"]);

// แปลง error จาก DB เป็นข้อความไทย (ข้อความจาก trigger เป็นไทยอยู่แล้ว) — error ดิบยังอยู่ที่ตัวที่ throw ไว้สำหรับดีบัก
export function counterPickError(e: unknown, fallback = "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"): string {
  const err = e as { message?: string; details?: string; code?: string } | null;
  if (err?.details && KNOWN.has(err.details) && err.message) return err.message;
  if (err?.code === "42501") return "ต้องเข้าสู่ระบบก่อน";
  if (err?.code === "23505") return "มี Counter คู่นี้อยู่แล้ว";
  if (err?.code === "23503") return "ไม่พบฮีโร่ที่เลือก";
  if (err?.code === "23514") return "ข้อมูล Counter ไม่ถูกต้อง (ฮีโร่ศัตรูกับฮีโร่ที่สู้ต้องไม่ใช่ตัวเดียวกัน)";
  return fallback;
}
