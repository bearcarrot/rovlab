// Mock guide content — clearly labeled. Structure mirrors the guides/guide_categories
// tables so it can be swapped for a Supabase query later without touching the UI.
import type { GuideCategory, GuideDetail, GuideSummary } from "@/types/guide";

export const GUIDE_CATEGORIES: GuideCategory[] = [
  { slug: "beginner", nameTh: "เริ่มต้น" },
  { slug: "macro", nameTh: "Macro" },
  { slug: "micro", nameTh: "Micro" },
  { slug: "laning", nameTh: "การเล่นเลน" },
  { slug: "jungle", nameTh: "การเดินป่า" },
  { slug: "teamfight", nameTh: "การรวมทีม" },
  { slug: "objective", nameTh: "Objective" },
  { slug: "draft", nameTh: "การดราฟต์" },
  { slug: "itemization", nameTh: "การเลือกไอเทม" },
];

export const GUIDES: GuideSummary[] = [
  {
    id: "g1",
    slug: "vision-control-basics",
    title: "วางวิชั่นให้เป็น ก่อนเสียชีวิตฟรีน้อยลง",
    categorySlug: "macro",
    difficulty: "easy",
    readingMinutes: 4,
    excerpt: "หลักการวาง Ward พื้นฐานที่ช่วยลดการโดนแทงจากจุดบอด โดยเฉพาะก่อน Objective",
  },
  {
    id: "g2",
    slug: "wave-management-101",
    title: "จัดการเวฟครีพให้เป็น เล่นเลนได้เปรียบขึ้นทันที",
    categorySlug: "laning",
    difficulty: "easy",
    readingMinutes: 5,
    excerpt: "แยกความต่างระหว่างเวฟ Freeze / Push / Slow push และควรใช้เมื่อไหร่",
  },
  {
    id: "g3",
    slug: "jungle-pathing-early-game",
    title: "เส้นทางเดินป่าช่วงต้นเกมที่ทำให้ฟาร์มไว ไม่เสียจังหวะ Gank",
    categorySlug: "jungle",
    difficulty: "medium",
    readingMinutes: 6,
    excerpt: "ลำดับการตีมอนสเตอร์และจังหวะเช็กเลนที่คุ้มค่าที่สุดในนาทีที่ 0–5",
  },
  {
    id: "g4",
    slug: "when-to-engage-teamfight",
    title: "จะเปิดไฟต์เมื่อไหร่ดี อ่านจังหวะจากอะไรบ้าง",
    categorySlug: "teamfight",
    difficulty: "medium",
    readingMinutes: 7,
    excerpt: "เช็กลิสต์ก่อนเปิดไฟต์: ตำแหน่งศัตรู, สกิลสำคัญที่ถูกใช้ไปแล้ว, ตำแหน่งทีมตัวเอง",
  },
  {
    id: "g5",
    slug: "drafting-around-your-carry",
    title: "ดราฟต์ทีมรอบตัวแคร์รี่ของคุณให้ปลอดภัยที่สุด",
    categorySlug: "draft",
    difficulty: "hard",
    readingMinutes: 8,
    excerpt: "หลักการเลือกฮีโร่สนับสนุนและแนวหน้าให้เข้ากับสไตล์ตัวแคร์รี่หลักของทีม",
  },
  {
    id: "g6",
    slug: "core-vs-situational-items",
    title: "ไอเทมหลักกับไอเทมตามสถานการณ์ ต่างกันตรงไหน ต้องสลับเมื่อไหร่",
    categorySlug: "itemization",
    difficulty: "medium",
    readingMinutes: 5,
    excerpt: "วิธีอ่านคอมโพสิชันฝั่งศัตรูเพื่อตัดสินใจสลับไอเทมตามสถานการณ์",
  },
];

export const GUIDE_DETAILS: Record<string, GuideDetail> = {
  "vision-control-basics": {
    ...GUIDES[0],
    isMock: true,
    heroRefs: [],
    content: [
      "วิชั่นคือข้อมูล ยิ่งเห็นตำแหน่งศัตรูได้เร็ว ยิ่งตัดสินใจได้แม่นขึ้น หลักการง่าย ๆ คือวาง Ward ไว้บริเวณจุดที่ศัตรูต้องเดินผ่านเพื่อเข้าเลนหรือ Objective",
      "ก่อนถึงเวลา Objective ใหญ่ประมาณ 45 วินาที ควรมีวิชั่นครอบคลุมพื้นที่รอบ Objective อย่างน้อย 2 จุด เพื่อลดโอกาสโดนไดฟ์แบบไม่ทันตั้งตัว",
      "หลีกเลี่ยงการวาง Ward ซ้ำจุดเดิมทุกเกม ศัตรูที่จำแพทเทิร์นได้จะเคลียร์วิชั่นทิ้งง่าย สลับจุดบ้างตามสถานการณ์",
    ],
  },
};
