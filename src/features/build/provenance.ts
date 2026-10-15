import type { HeroBuild } from "@/types/item";

// ป้ายที่มาของบิลด์ ใช้ร่วมกันทุกหน้า (Hero Detail, Item Build) — บิลด์ไหนไม่ใช่ top_server ห้ามเรียกว่า Top Server
export function buildProvenance(b: Pick<HeroBuild, "source" | "serverRank">) {
  if (b.source === "top_server") return { label: b.serverRank ? `Top Server อันดับ ${b.serverRank} (จากในเกม)` : "Top Server (จากในเกม)", fromGame: true };
  if (b.source === "curated") return { label: "บิลด์ทีมงาน RoV LAB (ไม่ใช่บิลด์ Top Server)", fromGame: false };
  return { label: "แนวทางทั่วไปจากระบบ RoV LAB (Heuristic)", fromGame: false };
}

export const NO_TOP_SERVER_NOTE = "ยังไม่มีบิลด์ Top Server ที่ยืนยันแล้วของฮีโร่นี้ บิลด์ด้านล่างเป็นคำแนะนำของ RoV LAB";
