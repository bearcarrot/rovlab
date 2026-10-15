import type { HeroBuild } from "@/types/item";

export const buildSourceLabel = (b: Pick<HeroBuild, "source">) => (b.source === "curated" ? "บิลด์ทีมงาน RoV LAB" : "แนวทางทั่วไป (Heuristic)");

// บิลด์ในระบบเป็นของ RoV LAB เอง ไม่ใช่ข้อมูล Top Server — เกมมีบิลด์ Top 10 Server ของฮีโร่แต่ละตัวที่อัปเดตเรียลไทม์กว่า
export const IN_GAME_TOP_SERVER_NOTE = "บิลด์ของ RoV LAB อาจอัปเดตไม่เท่าในเกม แนะนำให้ดูบิลด์ Top 10 Server ของฮีโร่ตัวนี้ในเกมเป็นหลัก (อัปเดตเรียลไทม์)";
