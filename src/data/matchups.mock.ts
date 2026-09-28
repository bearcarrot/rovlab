import type { MatchupDetail } from "@/types/matchup";

// Hand-authored matchups — key is "heroA__heroB" sorted alphabetically so lookup
// works regardless of selection order.
export const MOCK_MATCHUPS: Record<string, MatchupDetail> = {
  florentino__zata: {
    heroA: "florentino",
    heroB: "zata",
    lane: "Mid",
    difficulty: "ปานกลาง",
    early: "Zata กดดันได้มากกว่าด้วยคอมโบระยะสั้น แต่ Florentino ยิงตอบได้ถ้ารักษาระยะ",
    mid: "Florentino เริ่มมีค่าพลังสะสมมากพอจะดาเมจแรง ควรเลี่ยงปะทะประชิด",
    late: "ทั้งคู่มีดาเมจปลายเกมสูง ฝ่ายที่โดนเปิดตัวก่อนมักเสียเปรียบ",
    winCondition: "Florentino ต้องยืนระยะไกลสุดที่ยิงโดน และหลีกเลี่ยงถูก Zata เข้าคอมโบ",
    tips: "ซื้อรองเท้าลดคูลดาวน์ก่อนเพื่อยิงสะสมพลังได้ถี่ขึ้นตั้งแต่ต้นเกม",
    source: "curated",
  },
};
