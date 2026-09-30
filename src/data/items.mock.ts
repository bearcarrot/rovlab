import type { HeroBuild, ItemSummary } from "@/types/item";
import { MOCK_PATCH } from "./heroes.mock";

// Offline fallback only (used when Supabase env vars are missing). The live app
// reads the `items` table; build slugs below refer to rows in that table.
export const MOCK_ITEMS: ItemSummary[] = [
  { id: "i1", slug: "sword-of-eternity", name: "Sword of Eternity", nameTh: "ดาบนิรันดร์", cost: 2050, stats: ["+65 พลังโจมตี", "+15% คริติคอล"], passive: "Passive: โจมตีคริติคอลเพิ่มดาเมจตามเลือดที่ขาดของศัตรู", icon: "" },
  { id: "i2", slug: "sages-blade", name: "Sage's Blade", nameTh: "ดาบปราชญ์", cost: 2010, stats: ["+65 พลังโจมตี", "+250 พลังชีวิต"], passive: "Passive: โจมตีพื้นฐานเผาผลาญเลือดศัตรูตามเปอร์เซ็นต์", icon: "" },
  { id: "i3", slug: "shield-of-the-lost-temple", name: "Shield of the Lost Temple", nameTh: "โล่วิหารที่สาบสูญ", cost: 2100, stats: ["+900 พลังชีวิต", "+40 เกราะกายภาพ"], passive: "Passive: ได้รับโล่พลังงานเมื่อ HP ต่ำกว่า 40%", icon: "" },
  { id: "i4", slug: "faith-boots", name: "Faith Boots", nameTh: "รองเท้าแห่งศรัทธา", cost: 738, stats: ["+45 ความเร็วเคลื่อนที่", "+5% ลดคูลดาวน์"], passive: "", icon: "" },
  { id: "i5", slug: "book-of-eternity", name: "Book of Eternity", nameTh: "หนังสือนิรันดร์", cost: 2000, stats: ["+150 พลังเวท", "+600 มานา"], passive: "Passive: โจมตีด้วยสกิลเผาผลาญมานาศัตรู", icon: "" },
  { id: "i6", slug: "black-warrior-cape", name: "Black Warrior Cape", nameTh: "เสื้อคลุมนักรบมืด", cost: 2000, stats: ["+900 พลังชีวิต", "+40 เกราะเวท"], passive: "Passive: ลดดาเมจเวทที่ได้รับเมื่อ HP ต่ำ", icon: "" },
  { id: "i7", slug: "bewitching-bow", name: "Bewitching Bow", nameTh: "ธนูมนตรา", cost: 2080, stats: ["+70 พลังโจมตี", "+20% ความเร็วโจมตี"], passive: "Passive: โจมตีพื้นฐานเจาะเกราะเพิ่มขึ้นตามจำนวนการโจมตี", icon: "" },
];

// Hand-authored build reasoning for the one hero we have full detail for (Florentino).
// Every other hero falls back to a generic role-based build in services/items.ts.
export const MOCK_BUILDS: Record<string, HeroBuild> = {
  florentino: {
    heroSlug: "florentino",
    patch: MOCK_PATCH,
    source: "curated",
    items: [
      { itemSlug: "giay-thuat-si", reason: "ลดคูลดาวน์ช่วยให้ยิงกระสุนสะสมพลังได้ถี่ขึ้น", phase: "early" },
      { itemSlug: "thanh-kiem", reason: "คริติคอลช่วยเพิ่มดาเมจปลายเกมเมื่อค่าพลังสะสมเต็ม", phase: "core" },
      { itemSlug: "thuong-xuyen-pha", reason: "เจาะเกราะช่วยให้ดาเมจยังทะลุแม้ศัตรูซื้อเกราะ", phase: "core" },
      { itemSlug: "khien-that-truyen", reason: "ซื้อเมื่อโดนไดฟ์บ่อย เพิ่มความอึดตอนยืนยิง", phase: "situational" },
    ],
    arcana: [{ name: "Sage x10", reason: "ลดคูลดาวน์และเพิ่มมานา ช่วยให้ใช้สกิลถี่ขึ้นตั้งแต่ต้นเกม" }],
  },
};
