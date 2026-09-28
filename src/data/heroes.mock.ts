// Mock data — clearly labeled, matches the HeroSummary/HeroDetail shape so it can be
// swapped for a Supabase query (see services/heroes.ts) without touching UI components.
import type { HeroDetail, HeroSummary } from "@/types/hero";

export const MOCK_PATCH = "1.51";

export const MOCK_HEROES: HeroSummary[] = [
  { id: "1", slug: "florentino", name: "Florentino", nameTh: "ฟลอเรนติโน่", role: "assassin", lane: "jungle", difficulty: "medium", icon: "/heroes/florentino.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 51.2, pickRate: 18.4, banRate: 42.1, tier: "S", matches: 128000, hasStats: true } },
  { id: "2", slug: "zata", name: "Zata", nameTh: "ซาต้า", role: "mage", lane: "mid", difficulty: "hard", icon: "/heroes/zata.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 49.8, pickRate: 9.2, banRate: 6.5, tier: "A", matches: 64000, hasStats: true } },
  { id: "3", slug: "thane", name: "Thane", nameTh: "เทน", role: "tank", lane: "abyssal", difficulty: "easy", icon: "/heroes/thane.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 53.4, pickRate: 22.7, banRate: 15.3, tier: "S", matches: 151000, hasStats: true } },
  { id: "4", slug: "violet", name: "Violet", nameTh: "ไวโอเล็ต", role: "marksman", lane: "abyssal", difficulty: "medium", icon: "/heroes/violet.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 50.1, pickRate: 14.8, banRate: 4.2, tier: "A", matches: 98000, hasStats: true } },
  { id: "5", slug: "lauriel", name: "Lauriel", nameTh: "ลอริเอล", role: "support", lane: "support", difficulty: "easy", icon: "/heroes/lauriel.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 52.6, pickRate: 11.1, banRate: 3.8, tier: "B", matches: 71000, hasStats: true } },
  { id: "6", slug: "liliana", name: "Liliana", nameTh: "ลิเลียนา", role: "fighter", lane: "slayer", difficulty: "medium", icon: "/heroes/liliana.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 48.3, pickRate: 7.6, banRate: 2.1, tier: "B", matches: 42000, hasStats: true } },
  { id: "7", slug: "airi", name: "Airi", nameTh: "แอรี่", role: "assassin", lane: "jungle", difficulty: "hard", icon: "/heroes/airi.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 47.9, pickRate: 6.4, banRate: 3.0, tier: "B", matches: 39000, hasStats: true } },
  { id: "8", slug: "ignis", name: "Ignis", nameTh: "อิกนิส", role: "mage", lane: "mid", difficulty: "medium", icon: "/heroes/ignis.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 50.6, pickRate: 12.9, banRate: 5.1, tier: "A", matches: 82000, hasStats: true } },
  { id: "9", slug: "omega", name: "Omega", nameTh: "โอเมก้า", role: "marksman", lane: "abyssal", difficulty: "easy", icon: "/heroes/omega.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 49.0, pickRate: 10.3, banRate: 2.4, tier: "B", matches: 55000, hasStats: true } },
  { id: "10", slug: "zephys", name: "Zephys", nameTh: "เซฟิส", role: "tank", lane: "slayer", difficulty: "medium", icon: "/heroes/zephys.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 54.1, pickRate: 16.0, banRate: 9.7, tier: "S", matches: 90000, hasStats: true } },
  { id: "11", slug: "krixi", name: "Krixi", nameTh: "คริกซี่", role: "mage", lane: "mid", difficulty: "medium", icon: "/heroes/krixi.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 51.8, pickRate: 13.5, banRate: 8.0, tier: "A", matches: 77000, hasStats: true } },
  { id: "12", slug: "baldum", name: "Baldum", nameTh: "บัลดั้ม", role: "tank", lane: "jungle", difficulty: "hard", icon: "/heroes/baldum.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 46.5, pickRate: 4.1, banRate: 1.2, tier: "C", matches: 21000, hasStats: true } },
  { id: "13", slug: "yena", name: "Yena", nameTh: "เยน่า", role: "fighter", lane: "slayer", difficulty: "easy", icon: "/heroes/yena.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 52.0, pickRate: 19.2, banRate: 11.4, tier: "S", matches: 132000, hasStats: true } },
  { id: "14", slug: "cresht", name: "Cresht", nameTh: "เครช", role: "support", lane: "support", difficulty: "medium", icon: "/heroes/cresht.png", stat: { patch: MOCK_PATCH, rankTier: "Diamond+", winRate: 50.9, pickRate: 8.8, banRate: 3.3, tier: "A", matches: 48000, hasStats: true } },
];

export const MOCK_HERO_DETAILS: Record<string, HeroDetail> = {
  florentino: {
    ...MOCK_HEROES[0],
    description: "อัศวินไม้เท้าที่เก็บค่าพลังจากการเดินและใช้สกิลเพื่อยิงกระสุนพลังทะลุแนว เหมาะกับการเคลื่อนที่เข้าออกไฟต์เร็ว",
    abilities: [],
    strengths: ["ระยะยิงไกล ปลอดภัยตอนฟาร์ม", "หนีไฟต์ได้ดีด้วย Ultimate", "ค่าพลังสะสมทำให้ดาเมจปลายเกมสูง"],
    weaknesses: ["ช่วงต้นเกมค่าพลังต่ำ ดาเมจน้อย", "ไม่มีสกิลป้องกันตัวโดยตรง เสี่ยงโดนไดฟ์", "ต้องอาศัยพื้นที่โล่งเพื่อยิงเข้าเป้า"],
    counteredBy: [
      { heroSlug: "thane", strength: "good", reason: "มีสกิลผลักและล็อกระยะประชิดที่ตัดจังหวะสะสมพลังของ Florentino ได้", laneTip: "เปิดสกิลใส่ก่อนที่ Florentino จะเก็บระยะยิง" },
      { heroSlug: "airi", strength: "best", reason: "กระโดดเข้าประชิดได้เร็วมาก ตัดโอกาสที่ Florentino จะยืนยิงจากระยะไกล", laneTip: "ใช้ Ultimate กระโดดเข้าทันทีที่เห็นตัว อย่าปล่อยให้สะสมค่าพลัง" },
    ],
    countersAgainst: [
      { heroSlug: "zata", strength: "good", reason: "ระยะยิงไกลกว่าทำให้ปะทะระยะไกลก่อน Zata เข้าคอมโบได้ทัน", laneTip: "รักษาระยะห่างและยิงสวนก่อน Zata กดสกิล 2" },
    ],
    synergies: [{ heroSlug: "lauriel", reason: "โล่และฮีลช่วยให้ Florentino ยืนยิงสะสมพลังได้นานขึ้น" }],
  },
  thane: {
    ...MOCK_HEROES[2],
    description: "แทงค์ระยะประชิดที่ผลักและกดศัตรูเข้าหากำแพง เปิดไฟต์ได้ทรงพลังเมื่อจับตัวติด",
    abilities: [],
    strengths: ["เปิดไฟต์ได้เด็ดขาดเมื่อกดติดกำแพง", "อึดพอจะยืนแนวหน้าได้ตลอดเกม", "กดดันเลนได้ตั้งแต่ต้นเกม"],
    weaknesses: ["ไม่มีดาเมจสูงหากจับตัวไม่ติด", "เคลื่อนที่ช้าหากไม่มีสกิลเร่งความเร็ว", "เป้านิ่งให้ศัตรูโฟกัสง่าย"],
    counteredBy: [{ heroSlug: "zata", strength: "good", reason: "มีระยะสกิลไกลและซีซีสวนกลับได้ก่อน Thane จะเข้าประชิด", laneTip: "รักษาระยะและใช้สกิลชะลอก่อน Thane จะกดผนัง" }],
    countersAgainst: [{ heroSlug: "florentino", strength: "good", reason: "ผลักเข้าประชิดตัดจังหวะสะสมพลังได้ทันที", laneTip: "เปิดสกิลใส่ก่อนที่ Florentino จะเก็บระยะยิง" }],
    synergies: [{ heroSlug: "krixi", reason: "Thane เปิดตัวติดแล้ว Krixi ตามด้วยดาเมจพื้นที่จบไฟต์เร็ว" }],
  },
};
