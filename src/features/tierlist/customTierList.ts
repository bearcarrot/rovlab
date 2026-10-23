import { NAME_MAX, emptyTierData, parseDraft, type TierData } from "./tierData";

// Tier List ของฉัน: ร่างเก็บฝั่ง Browser (React state + localStorage) ส่วนการเก็บบนบัญชีทำที่ cloudTierList / services/userTierLists
export const CUSTOM_TIER_KEY = "rovlab:custom-tier-list";
export const DEFAULT_CUSTOM_NAME = "Tier List ของฉัน";
export { NAME_MAX };

export type CustomTiers = TierData; // แถวเรียงตามที่ผู้ใช้จัด แต่ละแถวมี hero id เรียงตามลำดับ

// version 1 = ร่างเก่าแบบ 5 Tier ตายตัว (อ่านได้ ย้ายเป็น 2 ตอนเปิด) · version 2 = แถวที่ผู้ใช้กำหนดเอง
// allowDuplicates = ตั้งค่าต่อลิสต์ "อนุญาตให้ฮีโร่อยู่ได้หลาย Tier" (ไม่มีในร่างเก่า = ปิด)
export interface CustomTierList {
  version: 2;
  name: string;
  patch: string;
  tiers: CustomTiers;
  allowDuplicates: boolean;
}

export const createDefault = (patch = ""): CustomTierList => ({
  version: 2,
  name: DEFAULT_CUSTOM_NAME,
  patch,
  tiers: emptyTierData(),
  allowDuplicates: false,
});

// อ่านค่าจาก localStorage แบบป้องกันค่าเสีย/schema เก่า/ผู้ใช้ปิด storage
export function loadCustom(): CustomTierList | null {
  try {
    const raw = localStorage.getItem(CUSTOM_TIER_KEY);
    if (!raw) return null;
    const d = parseDraft(JSON.parse(raw));
    return d && { version: 2, ...d };
  } catch {
    return null;
  }
}

export function saveCustom(list: CustomTierList): void {
  try {
    localStorage.setItem(CUSTOM_TIER_KEY, JSON.stringify(list));
  } catch {
    // เก็บไม่ได้ (โหมดส่วนตัว/เต็ม) — ยังใช้งานต่อในหน่วยความจำได้
  }
}

export function clearCustom(): void {
  try {
    localStorage.removeItem(CUSTOM_TIER_KEY);
  } catch {
    // ไม่เป็นไร
  }
}
