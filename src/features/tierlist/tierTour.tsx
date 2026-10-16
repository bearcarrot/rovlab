import type { Step } from "@/features/draft/DraftOnboarding";

// แฟลกเดียวใน localStorage แยกจากทัวร์ของ Draft Assistant
export const TIER_TOUR_KEY = "rovlab:tierlist:onboarding:v1";

// ทุกขั้นชี้ element จริงของหน้า Tier List ทางการ (data-tour ใน pages/TierList.tsx)
export const TIER_TOUR_STEPS: Step[] = [
  {
    title: "Tier List คืออะไร?",
    body: () => (
      <p>
        จัดกลุ่มฮีโร่ตามแพตช์และแรงก์ที่เลือก (สลับช่วงแรงก์ได้ที่ปุ่มบน Header) ใช้ประกอบการเลือกฮีโร่
        ไม่ใช่คำตอบตายตัว จะพาไปดูทีละจุดบนหน้านี้
      </p>
    ),
  },
  {
    target: "tier-modes",
    title: "3 โหมด",
    body: () => (
      <p>
        “Tier List ทางการ” คือลิสต์ที่เห็นอยู่ตอนนี้ “Tier List ของฉัน” ให้จัดอันดับเองและบันทึกบนบัญชีได้
        ส่วน “Community” คือ Tier List ที่คนอื่นเผยแพร่ ดูแล้วโหลดมาแก้เป็นของตัวเองได้
      </p>
    ),
  },
  {
    target: "tier-filters",
    fallback: "tier-modes",
    title: "ตัวกรอง",
    body: () => (
      <p>กรองตามบทบาท เลน และ Tier ระบบจำค่าที่เลือกไว้ แตะซ้ำที่ตัวเลือกเดิมเพื่อกลับเป็นทั้งหมด</p>
    ),
  },
  {
    target: "tier-group",
    fallback: "tier-modes",
    title: "อ่าน Tier List",
    body: () => (
      <p>
        ฮีโร่ถูกจัดเป็นกลุ่มตามป้าย Tier ในแต่ละกลุ่มเรียง A–Z ไม่ใช่ลำดับความแข็ง แตะไอคอนฮีโร่เพื่อดูข้อมูลของตัวนั้น
      </p>
    ),
  },
  {
    target: "tier-share",
    fallback: "tier-modes",
    title: "แชร์ Tier List",
    body: () => (
      <p>
        แชร์เป็นรูปหรือลิงก์ตามตัวกรองที่ใช้อยู่ ผู้รับเปิดลิงก์ดูได้โดยไม่ต้องล็อกอิน
        และกดปุ่ม “วิธีใช้งาน” ข้างหัวข้อหน้าเมื่อไหร่ก็ได้เพื่อเปิดคู่มือนี้อีกครั้ง
      </p>
    ),
  },
];
