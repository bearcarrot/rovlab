import { GUIDES, GUIDE_DETAILS, GUIDE_CATEGORIES } from "@/data/guides.mock";
import type { GuideDetail, GuideSummary } from "@/types/guide";

const SIMULATED_LATENCY = 250;
function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), SIMULATED_LATENCY));
}

export async function getGuides(): Promise<GuideSummary[]> {
  // TODO(supabase): supabase.from("guides").select(...) joined with guide_categories
  return delay(GUIDES);
}

export async function getGuideCategories() {
  return delay(GUIDE_CATEGORIES);
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
  const summary = GUIDES.find((g) => g.slug === slug);
  if (!summary) return delay(null);
  return delay(GUIDE_DETAILS[slug] ?? fallbackGuideDetail(summary));
}
