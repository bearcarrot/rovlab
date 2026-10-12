import type { HeroSummary } from "@/types/hero";

// ตัวค้นหาชื่อฮีโร่กลาง: ค้นได้ทั้งชื่ออังกฤษ (ชื่อที่เว็บแสดง) และชื่อไทย (heroes.name_th → HeroSummary.thaiName)
// ใช้ร่วมกันทุกหน้าที่มีช่องค้นหาฮีโร่ เพื่อไม่ให้แต่ละหน้ามีเงื่อนไขค้นหาเป็นของตัวเอง

// วรรณยุกต์ + ทัณฑฆาต (่ ้ ๊ ๋ ์): ผู้ใช้มักพิมพ์ตกหรือพิมพ์ผิด จึงไม่นำมาเทียบ
const THAI_MARKS = /[\u0E48-\u0E4C]/g;

/** รูปแบบสำหรับเทียบ: NFC, ตัวพิมพ์เล็ก, ไม่มีช่องว่าง/เครื่องหมาย (พิมพ์ "azzenka" ก็เจอ Azzen'Ka), ไม่มีวรรณยุกต์ไทย */
export function searchKey(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(THAI_MARKS, "")
    .replace(/[\s'’`"\-_.]/g, "");
}

/** true เมื่อ query ว่าง หรือเป็นส่วนหนึ่งของชื่ออังกฤษ/ชื่อไทยของฮีโร่ */
export function heroMatchesQuery(hero: Pick<HeroSummary, "name" | "nameTh" | "thaiName">, query: string): boolean {
  const q = searchKey(query);
  if (q === "") return true;
  return [hero.name, hero.nameTh, hero.thaiName].some((s) => !!s && searchKey(s).includes(q));
}
