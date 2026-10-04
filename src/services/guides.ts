import { GUIDES, GUIDE_DETAILS, GUIDE_CATEGORIES } from "@/data/guides.mock";
import type { GuideCategory, GuideDetail, GuideSummary } from "@/types/guide";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// คู่มือดึงจาก Supabase (ตาราง guides + guide_categories) ถ้าตั้งค่า Supabase แล้ว
// ถ้ายังไม่ได้ตั้งค่า (เช่นรัน dev โดยไม่มี .env) จะใช้ข้อมูลตัวอย่างจาก guides.mock แทน
//
// guides.content เก็บเป็นข้อความ (markdown) แยกย่อหน้าด้วยบรรทัดว่าง
// guides.hero_refs เก็บเป็น uuid ของฮีโร่ จึงแปลงเป็น slug + ชื่อตอนเปิดหน้ารายละเอียด
// ตารางยังไม่มีคอลัมน์ excerpt จึงตัดจากย่อหน้าแรกของ content ให้

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
  guide_categories: DbCategoryRef | DbCategoryRef[] | null;
};

const GUIDE_COLS = "id, slug, title, difficulty, reading_minutes, content, hero_refs, guide_categories(slug)";

function toParagraphs(content: string | null): string[] {
  return (content ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function toExcerpt(paragraphs: string[]): string {
  const first = (paragraphs[0] ?? "").replace(/^[#>*\-\s]+/, "").replace(/\s+/g, " ");
  return first.length > 120 ? `${first.slice(0, 120).trimEnd()}…` : first;
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
  };
}

export async function getGuides(): Promise<GuideSummary[]> {
  if (!isSupabaseConfigured) return delay(GUIDES);
  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_COLS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DbGuideRow[]).map(toSummary);
}

export async function getGuideCategories(): Promise<GuideCategory[]> {
  if (!isSupabaseConfigured) return delay(GUIDE_CATEGORIES);
  const { data, error } = await supabase
    .from("guide_categories")
    .select("slug, name_th")
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
