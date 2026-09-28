import type { Insight } from "@/types/insight";

// Example of the required insight shape: what happened -> why -> fix -> practice.
// This is what every "actionable insight" card in the app must produce, whether the
// source is real match data (later) or this mock set (now).
export const MOCK_INSIGHTS: Insight[] = [
  {
    id: "death-window-8-12",
    title: "เสียชีวิตถี่ในนาที 8–12",
    whatHappened: "คุณมี Death สูงในช่วงนาที 8–12 และมักเสียชีวิตก่อน Objective ใหญ่ประมาณ 20–30 วินาที",
    whyItHappened: "แนวโน้มคือเข้าไฟต์ก่อนเพื่อนร่วมทีมหรือเช็ก Vision บริเวณ Objective ไม่เพียงพอ",
    whatToFix: "รอให้เห็นตำแหน่งศัตรูอย่างน้อย 3 คนก่อนเปิดไฟต์ อย่าเป็นคนเปิดก่อน Objective",
    howToPractice: "ฝึกวาง Ward ก่อนถึงเวลา Objective 45 วินาที และรอสัญญาณจากทีมก่อนเข้าปะทะ",
    severity: "critical",
    isMock: true,
  },
  {
    id: "low-cs-early",
    title: "ฟาร์มช้าช่วง 0–5 นาที",
    whatHappened: "จำนวนบุกทำลายในนาทีที่ 5 ต่ำกว่าค่าเฉลี่ยของ Role เดียวกันในแรงค์เดียวกัน",
    whyItHappened: "อาจเสียเวลากับการไป Gank หรือเคลียร์ครีพไม่ครบเวฟก่อนเปลี่ยนเลน",
    whatToFix: "เคลียร์เวฟให้ครบก่อนตัดสินใจไป Gank เว้นแต่โอกาสสำเร็จสูงชัดเจน",
    howToPractice: "ฝึกโหมด Practice จับเวลาเคลียร์เวฟแรกให้ไม่เกิน 25 วินาที",
    severity: "moderate",
    isMock: true,
  },
];
