import { GUIDES, GUIDE_DETAILS, GUIDE_CATEGORIES } from "@/data/guides.mock";
import type { GuideCategory, GuideDetail, GuideSummary } from "@/types/guide";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// คู่มือดึงจาก Supabase (ตาราง guides + guide_categories) ถ้าตั้งค่า Supabase แล้ว
// ถ้ายังไม่ได้ตั้งค่า (เช่นรัน dev โดยไม่มี .env) จะใช้ข้อมูลตัวอย่างจาก guides.mock แทน
//
// guides.content เก็บเป็นข้อความ (markdown แบบย่อ) แยกย่อหน้าด้วยบรรทัดว่าง
// หน้ารายละเอียดแปลงเป็นหัวข้อ/ลิสต์/ลิงก์ด้วย components/guides/GuideContent
// guides.hero_refs เก็บเป็น uuid ของฮีโร่ จึงแปลงเป็น slug + ชื่อตอนเปิดหน้ารายละเอียด
// ตารางยังไม่มีคอลัมน์ excerpt จึงตัดจากย่อหน้าแรกที่ไม่ใช่หัวข้อของ content ให้
// sort_id (guides และ guide_categories) = ลำดับที่แอดมินตั้ง เล็ก = ก่อน (ต้องรัน migration 20261004_guides_sort_id.sql)

const SIMULATED_LATENCY = 250;
function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), SIMULATED_LATENCY));
}

type DbCategoryRef = { slug: string };
type DbGuideRow = {
  id: string;
  slug: string;
  title: string;
  difficulty: GuideSummary["difficulty"];
  reading_minutes: number | null;
  content: string | null;
  hero_refs: string[] | null;
  sort_id: number | null;
  guide_categories: DbCategoryRef | DbCategoryRef[] | null;
};

const GUIDE_COLS = "id, slug, title, difficulty, reading_minutes, content, hero_refs, sort_id, guide_categories(slug)";

function toParagraphs(content: string | null): string[] {
  return (content ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ถอด markdown ออกให้เหลือข้อความล้วน สำหรับคำโปรยในการ์ด
function stripMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\(https?:[^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(\*\*|\*|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// คำโปรย = ย่อหน้าแรกที่มีข้อความจริง (ข้ามบรรทัดหัวข้อ # ## ###)
function toExcerpt(paragraphs: string[]): string {
  for (const p of paragraphs) {
    const text = p
      .split("\n")
      .filter((l) => !/^\s*#{1,6}\s/.test(l))
      .join(" ")
      .replace(/^[\s>\-*•]+/, "");
    const clean = stripMarkdown(text);
    if (clean) return clean.length > 120 ? `${clean.slice(0, 120).trimEnd()}…` : clean;
  }
  return "";
}

function categorySlugOf(row: DbGuideRow): string {
  const c = row.guide_categories;
  const one = Array.isArray(c) ? c[0] : c;
  return one?.slug ?? "";
}

function toSummary(row: DbGuideRow): GuideSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    categorySlug: categorySlugOf(row),
    difficulty: row.difficulty ?? null,
    readingMinutes: row.reading_minutes ?? Math.max(1, Math.ceil((row.content ?? "").length / 800)),
    excerpt: toExcerpt(toParagraphs(row.content)),
    sortId: row.sort_id ?? 0,
  };
}

// เรียง sort_id น้อย → มาก แล้วใหม่สุดก่อน (หน้า Learn เอาไปเรียงต่อด้วยระดับความยากในกลุ่ม sort_id เดียวกัน)
export async function getGuides(): Promise<GuideSummary[]> {
  if (!isSupabaseConfigured) return delay(GUIDES);
  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_COLS)
    .order("sort_id", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DbGuideRow[]).map(toSummary);
}

export async function getGuideCategories(): Promise<GuideCategory[]> {
  if (!isSupabaseConfigured) return delay(GUIDE_CATEGORIES);
  const { data, error } = await supabase
    .from("guide_categories")
    .select("slug, name_th")
    .order("sort_id", { ascending: true })
    .order("name_th", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { slug: string; name_th: string }[]).map((c) => ({
    slug: c.slug,
    nameTh: c.name_th,
  }));
}

function fallbackGuideDetail(summary: GuideSummary): GuideDetail {
  return {
    ...summary,
    content: [summary.excerpt, "เนื้อหาฉบับเต็มของคู่มือนี้กำลังอยู่ระหว่างจัดทำ"],
    heroRefs: [],
    isMock: true,
  };
}

export async function getGuideBySlug(slug: string): Promise<GuideDetail | null> {
  if (!isSupabaseConfigured) {
    const summary = GUIDES.find((g) => g.slug === slug);
    if (!summary) return delay(null);
    return delay(GUIDE_DETAILS[slug] ?? fallbackGuideDetail(summary));
  }

  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as DbGuideRow;
  const paragraphs = toParagraphs(row.content);

  // hero_refs เป็น uuid → แปลงเป็น slug (ใช้ลิงก์ไปหน้าฮีโร่) และชื่อ (แสดงบนชิป)
  const heroIds = row.hero_refs ?? [];
  const heroNames: Record<string, string> = {};
  const heroRefs: string[] = [];
  if (heroIds.length > 0) {
    const { data: heroes } = await supabase.from("heroes").select("id, slug, name").in("id", heroIds);
    const byId = new Map(((heroes ?? []) as unknown as { id: string; slug: string; name: string }[]).map((h) => [h.id, h]));
    for (const id of heroIds) {
      const h = byId.get(id);
      if (!h) continue;
      heroRefs.push(h.slug);
      heroNames[h.slug] = h.name;
    }
  }

  return {
    ...toSummary(row),
    content: paragraphs.length > 0 ? paragraphs : ["เนื้อหาของคู่มือนี้ยังว่างอยู่"],
    heroRefs,
    heroNames,
    isMock: false,
  };
}
