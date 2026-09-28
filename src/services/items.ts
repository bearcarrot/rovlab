import { MOCK_BUILDS, MOCK_ITEMS } from "@/data/items.mock";
import type { HeroBuild } from "@/types/item";
import { MOCK_PATCH } from "@/data/heroes.mock";
import { ROLE_TAGS } from "@/features/draft/heroTags";
import type { HeroSummary } from "@/types/hero";

const SIMULATED_LATENCY = 250;
function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), SIMULATED_LATENCY));
}

export async function getItems() {
  // TODO(supabase): supabase.from("items").select(...)
  return delay(MOCK_ITEMS);
}

function genericBuildFor(hero: HeroSummary): HeroBuild {
  // Fallback build path based on role heuristic — used until a hand-authored
  // build exists for this hero. Kept honest by only using generic reasoning.
  const tag = ROLE_TAGS[hero.role];
  const damageItem = tag.damage === "magic" ? "book-of-eternity" : "sword-of-eternity";
  const items: HeroBuild["items"] = [
    { itemSlug: "faith-boots", reason: "รองเท้าพื้นฐานเพิ่มความเร็วเคลื่อนที่และลดคูลดาวน์", phase: "early" },
    { itemSlug: damageItem, reason: tag.damage === "magic" ? "เพิ่มพลังเวทเป็นแกนหลักของดาเมจ" : "เพิ่มพลังโจมตีเป็นแกนหลักของดาเมจ", phase: "core" },
  ];
  if (tag.frontline >= 2) {
    items.push({ itemSlug: "shield-of-the-lost-temple", reason: "เพิ่มความอึดให้ยืนแนวหน้าได้นานขึ้น", phase: "core" });
  } else {
    items.push({ itemSlug: "black-warrior-cape", reason: "ซื้อเมื่อฝั่งศัตรูมีดาเมจเวทสูง เพื่อลดความเสี่ยงโดนล้ม", phase: "situational" });
  }
  return { heroSlug: hero.slug, patch: MOCK_PATCH, source: "heuristic", items, arcana: [{ name: "Sage x10", reason: "ตัวเลือกกลาง ๆ ที่เข้าได้กับเกือบทุกฮีโร่ระหว่างรอข้อมูลเฉพาะตัว" }] };
}

export async function getBuildForHero(hero: HeroSummary): Promise<HeroBuild> {
  // TODO(supabase): supabase.from("item_builds")... joined with item_build_items
  return delay(MOCK_BUILDS[hero.slug] ?? genericBuildFor(hero));
}
