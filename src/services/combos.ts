import { supabase } from "@/lib/supabase";
import { toReaction, type Reaction } from "@/features/community/reactions";

// Combo = ฮีโร่ 2–5 ตัวที่เล่นคู่กันแล้วเสริมกัน (ตาราง user_combos)
// แนะนำ = is_featured (ทีมงานคัด) · ของฉัน = owner_id ตัวเอง · Community = เผยแพร่แล้วและไม่ถูกซ่อน
// สิทธิ์บังคับที่ RLS + trigger ใน DB (ดู supabase/migrations/20261022_user_combos.sql)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

export const MIN_HEROES = 2;
export const MAX_HEROES = 5;

export interface Combo {
  id: string;
  ownerId: string | null; // null = ทีมงานคัดมาเอง
  name: string;
  note: string;
  heroIds: string[]; // เรียงตามที่ผู้สร้างเลือก
  isPublic: boolean;
  hidden: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  author: string | null;
  likes: number;
  dislikes: number;
  myValue: Reaction;
}

const COLS = "id, owner_id, name, note, hero_ids, is_public, hidden, is_featured, published_at, updated_at";
// ตรงกับเพดาน 100 id ต่อครั้งของ RPC get_user_combo_meta
const LIMIT = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(r: any): Combo {
  return {
    id: r.id,
    ownerId: r.owner_id ?? null,
    name: r.name,
    note: r.note ?? "",
    heroIds: r.hero_ids ?? [],
    isPublic: r.is_public,
    hidden: r.hidden,
    isFeatured: r.is_featured ?? false,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    author: null,
    likes: 0,
    dislikes: 0,
    myValue: 0,
  };
}

// จำนวนถูกใจ/ไม่ถูกใจ + ค่าที่ผู้ใช้กดไว้ + ชื่อผู้สร้าง — ถ้า RPC พลาดให้แสดง Combo ต่อได้ (นับเป็น 0)
async function withMeta(list: Combo[]): Promise<Combo[]> {
  if (list.length === 0) return list;
  const { data, error } = await db.rpc("get_user_combo_meta", { p_ids: list.map((c) => c.id) });
  if (error) return list;
  const byId = new Map<string, Partial<Combo>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((data ?? []) as any[]).map((m) => [
      m.combo_id,
      {
        likes: m.like_count ?? 0,
        dislikes: m.dislike_count ?? 0,
        myValue: toReaction(m.my_value),
        author: m.author_name ?? (m.author_handle ? `@${m.author_handle}` : null),
      },
    ])
  );
  return list.map((c) => ({ ...c, ...(byId.get(c.id) ?? {}) }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function list(filter: (q: any) => any): Promise<Combo[]> {
  const { data, error } = await filter(db.from("user_combos").select(COLS)).limit(LIMIT);
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return withMeta((data ?? []).map((r: any) => map(r)));
}

export const listFeaturedCombos = () => list((q) => q.eq("is_featured", true).eq("hidden", false).order("name"));

// Combo แนะนำที่มีฮีโร่ตัวนี้อยู่ด้วย (ใช้ในหน้ารายละเอียดฮีโร่ — index GIN บน hero_ids)
export const listFeaturedCombosForHero = (heroId: string) =>
  list((q) => q.eq("is_featured", true).eq("hidden", false).contains("hero_ids", [heroId]).order("name"));

export const listCommunityCombos = () =>
  list((q) => q.eq("is_public", true).eq("hidden", false).eq("is_featured", false).order("published_at", { ascending: false }));

export const listMyCombos = (userId: string) => list((q) => q.eq("owner_id", userId).order("updated_at", { ascending: false }));

// แอดมิน: ทุก Combo รวมที่ซ่อน/ส่วนตัว (RLS ให้แอดมินอ่านได้หมด; ไม่ดึงสถิติไลก์เพราะ RPC คืนเฉพาะที่ผู้ใช้ทั่วไปเห็น)
export async function listAllCombos(): Promise<Combo[]> {
  const { data, error } = await db.from("user_combos").select(COLS).order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => map(r));
}

export interface SaveComboArgs {
  id: string | null;
  ownerId: string;
  name: string;
  note: string;
  heroIds: string[];
  isPublic: boolean;
  /** แอดมินสร้างใหม่เป็น Combo แนะนำ (trigger ใน DB จะล้างค่านี้ถ้าไม่ใช่แอดมิน) */
  featured?: boolean;
}

export async function saveCombo(a: SaveComboArgs): Promise<void> {
  const row = { name: a.name, note: a.note.trim() === "" ? null : a.note, hero_ids: a.heroIds, is_public: a.isPublic };
  const { error } = a.id
    ? await db.from("user_combos").update(row).eq("id", a.id)
    : await db.from("user_combos").insert({ ...row, owner_id: a.ownerId, ...(a.featured ? { is_featured: true } : {}) });
  if (error) throw error;
}

export async function setComboPublic(id: string, isPublic: boolean) {
  const { error } = await db.from("user_combos").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

// แอดมินเท่านั้นที่เปลี่ยนได้ (trigger ใน DB บังคับ): แนะนำ / ซ่อน
export async function setComboFlags(id: string, patch: { is_featured?: boolean; hidden?: boolean }) {
  const { error } = await db.from("user_combos").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCombo(id: string) {
  const { error } = await db.from("user_combos").delete().eq("id", id);
  if (error) throw error;
}

/** value 0 = ยกเลิกที่กดไว้ หนึ่งแถวต่อ (Combo, ผู้ใช้) เหมือน reactToBuild */
export async function reactToCombo(comboId: string, userId: string, value: Reaction): Promise<void> {
  if (value === 0) {
    const { error } = await db.from("user_combo_reactions").delete().eq("combo_id", comboId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("user_combo_reactions").upsert({ combo_id: comboId, user_id: userId, value }, { onConflict: "combo_id,user_id" });
  if (error) throw error;
}

const KNOWN = new Set(["PROFANITY_BLOCKED", "ACCOUNT_SUSPENDED", "INVALID_HEROES", "COMBO_LIMIT", "FORBIDDEN"]);

export function comboError(e: unknown, fallback = "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"): string {
  const err = e as { message?: string; details?: string; code?: string } | null;
  if (err?.details && KNOWN.has(err.details) && err.message) return err.message;
  if (err?.code === "42501") return "ต้องเข้าสู่ระบบก่อน";
  if (err?.code === "23514") return "ข้อมูล Combo ไม่ถูกต้อง (เลือกฮีโร่ 2–5 ตัว ห้ามซ้ำ)";
  return fallback;
}
