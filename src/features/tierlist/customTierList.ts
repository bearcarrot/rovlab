import { LANE_ALL, NAME_MAX, emptyLanes, parseLaneDraft, type TierData, type TierLanes } from "./tierData";

// Tier List ของฉัน: ร่างเก็บฝั่ง Browser (React state + localStorage) ส่วนการเก็บบนบัญชีทำที่ cloudTierList / services/userTierLists
export const CUSTOM_TIER_KEY = "rovlab:custom-tier-list";
export const DEFAULT_CUSTOM_NAME = "Tier List ของฉัน";
export { NAME_MAX };

export type CustomTiers = TierData; // แถวเรียงตามที่ผู้ใช้จัด แต่ละแถวมี hero id เรียงตามลำดับ (1 กระดาน = 1 เลน)

// หนึ่ง Tier List มีได้หลายเลน แต่ละเลนมีกระดาน (rows) ของตัวเอง — รูปแบบใน storage:
//   version 1 = ร่างเก่าแบบ 5 Tier ตายตัว · version 2 = แถวที่ผู้ใช้กำหนดเอง (เปิดเป็น 1 เลน "all")
//   version 3 = หลายเลน { name, patch, lanes } (เขียนเฉพาะเมื่อมีมากกว่า 1 เลนหรือเลนที่ไม่ใช่ "all")
export interface CustomTierList {
  version: 3;
  name: string;
  patch: string;
  lanes: TierLanes;
}

export const createDefault = (patch = ""): CustomTierList => ({
  version: 3,
  name: DEFAULT_CUSTOM_NAME,
  patch,
  lanes: emptyLanes(),
});

// เลนเดียว "all" เขียนเป็น version 2 เหมือนเดิมทุกประการ (build เก่า/แท็บเก่าอ่านได้ ไม่เห็นเป็นข้อมูลว่างแล้วเขียนทับ)
export function toStored(list: CustomTierList): unknown {
  if (list.lanes.length === 1 && list.lanes[0].id === LANE_ALL) {
    return { version: 2, name: list.name, patch: list.patch, tiers: list.lanes[0].rows };
  }
  return { version: 3, name: list.name, patch: list.patch, lanes: list.lanes };
}

const UNSUPPORTED_KEY = `${CUSTOM_TIER_KEY}:unsupported`;

// อ่านค่าจาก localStorage แบบป้องกันค่าเสีย/schema เก่า/ผู้ใช้ปิด storage
export function loadCustom(): CustomTierList | null {
  try {
    const raw = localStorage.getItem(CUSTOM_TIER_KEY);
    if (!raw) return null;
    const json: unknown = JSON.parse(raw);
    const d = parseLaneDraft(json);
    if (!d) {
      // รูปแบบใหม่กว่าที่ build นี้รู้จัก: เก็บสำรองไว้ก่อน เพราะร่างใหม่ที่ autosave จะเขียนทับคีย์นี้
      const v = (json as { version?: unknown } | null)?.version;
      if (typeof v === "number" && v > 3) localStorage.setItem(UNSUPPORTED_KEY, raw);
      return null;
    }
    return { version: 3, ...d };
  } catch {
    return null;
  }
}

export function saveCustom(list: CustomTierList): void {
  try {
    localStorage.setItem(CUSTOM_TIER_KEY, JSON.stringify(toStored(list)));
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
