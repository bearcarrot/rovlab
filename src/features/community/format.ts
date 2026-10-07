// Small pure helpers shared by Draft + Tier List "My / Community" features.

/** Thai relative time: "เมื่อสักครู่", "5 นาทีที่แล้ว", ... then a short Thai date after 30 days. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "เมื่อสักครู่";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} วันที่แล้ว`;
  return new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

const COPY_SUFFIX = " (Copy)";

/** "Name" -> "Name (Copy)", truncating the base so the result still fits `max` characters. */
export function copyName(name: string, max: number): string {
  const base = name.trim() || "Untitled";
  return base.length + COPY_SUFFIX.length <= max
    ? base + COPY_SUFFIX
    : base.slice(0, Math.max(0, max - COPY_SUFFIX.length)) + COPY_SUFFIX;
}
