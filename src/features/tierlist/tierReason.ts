import type { HeroSummary } from "@/types/hero";

export function tierReason(h: HeroSummary): string {
  const { winRate, banRate, pickRate } = h.stat;
  if (banRate >= 30) return `Win Rate ${winRate.toFixed(1)}% และถูกแบนสูงถึง ${banRate.toFixed(0)}% แสดงว่าคู่แข่งมองว่าอันตราย`;
  if (winRate >= 53) return `Win Rate สูงถึง ${winRate.toFixed(1)}% ในกลุ่มแรงค์นี้ ถือว่าคุ้มมิดต่อการหยิบ`;
  if (pickRate >= 18) return `ถูกหยิบบ่อย (${pickRate.toFixed(1)}%) และ Win Rate ${winRate.toFixed(1)}% อยู่ในเกณฑ์ดี`;
  if (winRate < 48) return `Win Rate ${winRate.toFixed(1)}% ต่ำกว่าค่าเฉลี่ย มักต้องการความเข้าใจตัวละครสูง`;
  return `Win Rate ${winRate.toFixed(1)}% อยู่ในเกณฑ์ปานกลาง เล่นได้แต่ไม่โดดเด่น`;
}
