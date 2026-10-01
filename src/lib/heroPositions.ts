import type { HeroLane, HeroRole, HeroSummary } from "@/types/hero";

// ฮีโร่ 1 ตัวอยู่ได้หลายตำแหน่ง/เลน (ตัวแรก = ตัวหลัก ตรงกับ hero.role / hero.lane)
// ข้อมูล mock หรือแถวเก่าที่ไม่มี roles/lanes จะใช้ role/lane เดียวแทน
export const heroRoles = (h: Pick<HeroSummary, "role" | "roles">): HeroRole[] =>
  h.roles && h.roles.length > 0 ? h.roles : [h.role];

export const heroLanes = (h: Pick<HeroSummary, "lane" | "lanes">): HeroLane[] =>
  h.lanes && h.lanes.length > 0 ? h.lanes : [h.lane];
