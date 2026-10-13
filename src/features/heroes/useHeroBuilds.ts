import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { getBuildsForHero, getItems, getLatestPatchCode } from "@/services/items";
import type { HeroBuild, ItemSummary } from "@/types/item";

// โหลดบิลด์แนะนำของฮีโร่ครั้งเดียว แล้วใช้ร่วมกันทั้งการ์ดบนหน้า Hero Detail และ context ของ Coach Ai
// (บิลด์ที่เลือกในการ์ด = บิลด์ที่ส่งให้ Coach Ai)
export function useHeroBuilds(hero: { id: string; slug: string } | null) {
  const q = useAsync(async () => {
    if (!hero) return null;
    const [builds, items, latestPatch] = await Promise.all([
      getBuildsForHero(hero),
      getItems(),
      getLatestPatchCode().catch(() => null), // ไม่ทราบแพตช์ล่าสุด ≠ error: แค่ไม่เทียบความใหม่
    ]);
    return { builds, items, latestPatch } as { builds: HeroBuild[]; items: ItemSummary[]; latestPatch: string | null };
  }, [hero?.id]);

  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [hero?.id]);

  const data = q.status === "success" ? q.data : null;
  const selected = data && data.builds.length > 0 ? data.builds[Math.min(index, data.builds.length - 1)] : null;
  return { q, data, selected, index, setIndex };
}

export type HeroBuildsState = ReturnType<typeof useHeroBuilds>;
