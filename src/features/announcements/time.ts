// Admin inputs are Asia/Bangkok (UTC+7, no DST) regardless of the browser's zone: fixed-offset math only.
const OFFSET_MS = 7 * 60 * 60 * 1000;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function bangkokLocalToIso(local: string): string {
  const m = LOCAL_RE.exec(local);
  if (!m) throw new Error("invalid local datetime");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // Date.UTC silently rolls over (Feb 30 -> Mar 2, month 13 -> next year): reject anything that did not round-trip.
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d || utc.getUTCHours() !== h || utc.getUTCMinutes() !== mi) {
    throw new Error("invalid local datetime");
  }
  return new Date(utc.getTime() - OFFSET_MS).toISOString();
}

export function isoToBangkokLocal(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error("invalid ISO datetime");
  return new Date(t + OFFSET_MS).toISOString().slice(0, 16);
}
