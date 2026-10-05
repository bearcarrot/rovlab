export interface MatchupCounterNote {
  winner: string; // slug ของฮีโร่ที่ชนะทาง
  loser: string; // slug ของฮีโร่ที่เสียเปรียบ
  strength: "best" | "good" | "situational";
  reason: string;
  laneTip: string;
}

export interface MatchupDetail {
  heroA: string;
  heroB: string;
  lane: string;
  difficulty: "ง่าย" | "ปานกลาง" | "ยาก";
  // ข้อความแผนเล่น: ว่าง ("") = ยังไม่มีข้อมูล หน้าเว็บจะไม่แสดงหัวข้อนั้น
  early: string;
  mid: string;
  late: string;
  winCondition: string;
  tips: string;
  source: "curated" | "heuristic";
  // สรุปจากสถิติจริง (Win Rate ของแต่ละตัว) ใช้เมื่อไม่มีแผนเล่นเขียนมือของคู่นี้
  summary?: string;
  // ความสัมพันธ์ชนะทางของสองตัวนี้จากตาราง hero_counters (สถิติแรงก์จริง)
  counterNotes?: MatchupCounterNote[];
}
