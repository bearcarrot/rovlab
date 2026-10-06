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
  // slug ของฮีโร่ที่แผนเล่นข้างบนเขียนจากมุมมองของตัวนั้น (hero_a ของแถวที่แอดมินกรอก)
  // ถ้าไม่ใช่ฮีโร่ฝั่งที่ผู้ใช้เลือก แปลว่าแผนเก็บไว้คนละทิศ ห้ามแสดงเป็นแผนของผู้ใช้
  planFor?: string;
  // สรุปจากสถิติจริง (Win Rate ของแต่ละตัว) ใช้เมื่อไม่มีแผนเล่นเขียนมือของคู่นี้
  summary?: string;
  // ความสัมพันธ์ชนะทางของสองตัวนี้จากตาราง hero_counters (สถิติแรงค์จริง)
  counterNotes?: MatchupCounterNote[];
}
