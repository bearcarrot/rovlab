// Halloween 2026 — ตรรกะเปิด/ปิดเอฟเฟกต์ตามฤดูกาล (ฟังก์ชันบริสุทธิ์ ไม่มี import ทดสอบด้วย node --test ได้)
// ลบทิ้งหลังจบแคมเปญ: ลบโฟลเดอร์ src/features/seasonal/ + tests/seasonal/ และ 2 บรรทัดใน AppShell.tsx

// สวิตช์ปิดฉุกเฉิน: เปลี่ยนเป็น false แล้ว redeploy เพื่อปิดเอฟเฟกต์ทั้งหมดทันที (ไม่ใช้ env var)
export const HALLOWEEN_ENABLED = true;

// ช่วงเปิด: 31 ต.ค. 2026 00:00 ถึงก่อน 1 พ.ย. 2026 00:00 ตามเวลาท้องถิ่นของผู้เยี่ยมชม
// (new Date(y, m, d) สร้างตามเขตเวลาของเครื่อง; เดือนเริ่มที่ 0 → 9 = ต.ค., 10 = พ.ย.)
export const HALLOWEEN_START_MS = new Date(2026, 9, 31, 0, 0, 0, 0).getTime();
export const HALLOWEEN_END_MS = new Date(2026, 10, 1, 0, 0, 0, 0).getTime();

function toMs(now: Date | number): number {
  return typeof now === "number" ? now : now.getTime();
}

/** เริ่มรวม (>= start) สิ้นสุดไม่รวม (< end); เวลาไม่ถูกต้อง (NaN) = ปิด */
export function isHalloweenActive(now: Date | number = Date.now(), enabled: boolean = HALLOWEEN_ENABLED): boolean {
  if (!enabled) return false;
  const t = toMs(now);
  if (!Number.isFinite(t)) return false;
  return t >= HALLOWEEN_START_MS && t < HALLOWEEN_END_MS;
}

/** มิลลิวินาทีที่เหลือถึงสิ้นสุด (ไม่เกิน 24 ชม. จึงใช้กับ setTimeout ได้) หรือ null ถ้าไม่ได้อยู่ในช่วง */
export function msUntilHalloweenEnd(now: Date | number = Date.now(), enabled: boolean = HALLOWEEN_ENABLED): number | null {
  if (!isHalloweenActive(now, enabled)) return null;
  return HALLOWEEN_END_MS - toMs(now);
}
